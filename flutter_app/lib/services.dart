import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'models.dart';

const apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://10.96.165.217:3001');

class ApiResult<T> {
  const ApiResult.success(this.data) : error = null;
  const ApiResult.failure(this.error) : data = null;
  final T? data;
  final String? error;
  bool get ok => error == null;
}

class CresaApi {
  CresaApi(this.client);
  final http.Client client;
  Map<String, String> headers(String? token) => {'Content-Type': 'application/json', if (token != null) 'Authorization': 'Bearer $token'};
  Future<ApiResult<Map<String, dynamic>>> request(String path, String token, {String method = 'GET', Map<String, dynamic>? body}) async {
    try {
      final uri = Uri.parse('$apiBaseUrl$path');
      final response = method == 'POST' ? await client.post(uri, headers: headers(token), body: jsonEncode(body ?? {})) : method == 'PATCH' ? await client.patch(uri, headers: headers(token), body: jsonEncode(body ?? {})) : await client.get(uri, headers: headers(token));
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode < 200 || response.statusCode >= 300 || json['ok'] == false) return ApiResult.failure('${json['error'] ?? 'Request failed.'}');
      return ApiResult.success(json);
    } catch (_) { return const ApiResult.failure('The Cresa API server is unavailable.'); }
  }
  Future<ApiResult<Map<String, dynamic>>> login(String identifier, String password) async {
    try { final response = await client.post(Uri.parse('$apiBaseUrl/api/auth/login'), headers: headers(null), body: jsonEncode({'identifier': identifier, 'password': password})); final json = jsonDecode(response.body) as Map<String, dynamic>; if (response.statusCode != 200 || json['ok'] != true) return ApiResult.failure('${json['error'] ?? 'Sign in failed.'}'); return ApiResult.success(json); } catch (_) { return const ApiResult.failure('The Cresa API server is unavailable.'); }
  }
  Future<ApiResult<Map<String, dynamic>>> register(Map<String, dynamic> input) async { try { final response = await client.post(Uri.parse('$apiBaseUrl/api/auth/register'), headers: headers(null), body: jsonEncode(input)); final json = jsonDecode(response.body) as Map<String, dynamic>; if (response.statusCode < 200 || response.statusCode >= 300) return ApiResult.failure('${json['error'] ?? 'Registration failed.'}'); return ApiResult.success(json); } catch (_) { return const ApiResult.failure('The Cresa API server is unavailable.'); } }
  Future<ApiResult<AuthUser>> me(String token) async { final result = await request('/api/me', token); return result.ok ? ApiResult.success(AuthUser.fromJson(Map<String, dynamic>.from(result.data!['user'] as Map))) : ApiResult.failure(result.error!); }
  Future<ApiResult<List<ResourceItem>>> resources(String token) async { final result = await request('/api/catalogue', token); return result.ok ? ApiResult.success((result.data!['resources'] as List).map((item) => ResourceItem.fromJson(Map<String, dynamic>.from(item as Map))).toList()) : ApiResult.failure(result.error!); }
  Future<ApiResult<List<CommunityPost>>> community(String token) async { final result = await request('/api/community', token); return result.ok ? ApiResult.success((result.data!['posts'] as List).map((item) => CommunityPost.fromJson(Map<String, dynamic>.from(item as Map))).toList()) : ApiResult.failure(result.error!); }
  Future<ApiResult<List<NotificationItem>>> notifications(String token) async { final result = await request('/api/notifications', token); return result.ok ? ApiResult.success((result.data!['notifications'] as List).map((item) => NotificationItem.fromJson(Map<String, dynamic>.from(item as Map))).toList()) : ApiResult.failure(result.error!); }
  Future<ApiResult<void>> readNotifications(String token) async { final result = await request('/api/notifications/read', token, method: 'POST'); return result.ok ? const ApiResult.success(null) : ApiResult.failure(result.error!); }
  Future<ApiResult<void>> createPost(String token, String content, List<String> tags) async { final result = await request('/api/community/posts', token, method: 'POST', body: {'content': content, 'tags': tags}); return result.ok ? const ApiResult.success(null) : ApiResult.failure(result.error!); }
  Future<ApiResult<void>> react(String token, String postId) async { final result = await request('/api/community/posts/$postId/reaction', token, method: 'POST'); return result.ok ? const ApiResult.success(null) : ApiResult.failure(result.error!); }
  Future<ApiResult<void>> comment(String token, String postId, String content) async { final result = await request('/api/community/posts/$postId/comments', token, method: 'POST', body: {'content': content}); return result.ok ? const ApiResult.success(null) : ApiResult.failure(result.error!); }
  Future<ApiResult<String>> askBot(String token, String prompt) async { final result = await request('/api/ai/chat', token, method: 'POST', body: {'prompt': prompt}); return result.ok ? ApiResult.success('${result.data!['answer'] ?? ''}') : ApiResult.failure(result.error!); }
  Future<ApiResult<String>> updateProfile(String token, Map<String, dynamic> body) async { final result = await request('/api/me/profile', token, method: 'PATCH', body: body); return result.ok ? const ApiResult.success('Saved') : ApiResult.failure(result.error!); }
}

class SessionStore {
  static const tokenKey = 'cresa_flutter_token';
  static const userKey = 'cresa_flutter_user';
  Future<(String?, AuthUser?)> read() async { final prefs = await SharedPreferences.getInstance(); final raw = prefs.getString(userKey); return (prefs.getString(tokenKey), raw == null ? null : AuthUser.fromJson(jsonDecode(raw) as Map<String, dynamic>)); }
  Future<void> save(String token, AuthUser user) async { final prefs = await SharedPreferences.getInstance(); await prefs.setString(tokenKey, token); await prefs.setString(userKey, jsonEncode({'id': user.id, 'name': user.name, 'identifier': user.identifier, 'role': user.role.name, 'identifierType': user.identifierType == IdentifierType.lecturerId ? 'lecturer_id' : 'registration_number', 'profile': user.profile, 'verified': user.verified})); }
  Future<void> clear() async { final prefs = await SharedPreferences.getInstance(); await prefs.remove(tokenKey); await prefs.remove(userKey); }
}
