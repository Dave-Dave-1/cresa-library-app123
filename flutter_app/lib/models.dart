enum UserRole { student, lecturer, administrator }

enum IdentifierType { registrationNumber, lecturerId }

class AuthUser {
  const AuthUser({required this.id, required this.name, required this.identifier, required this.role, this.identifierType = IdentifierType.registrationNumber, this.lecturerEmail, this.status, this.signedIn = false, this.verified = true, this.profile = const {}});
  final String id;
  final String name;
  final String identifier;
  final UserRole role;
  final IdentifierType identifierType;
  final String? lecturerEmail;
  final String? status;
  final bool signedIn;
  final bool verified;
  final Map<String, dynamic> profile;

  String? get avatarUrl => profile['avatarUrl'] as String?;
  String get course => (profile['course'] as String?) ?? '';
  bool get notificationsEnabled => profile['notificationsEnabled'] != false;
  bool get aiEnabled => profile['aiEnabled'] != false;
  bool get saveChatHistory => profile['saveChatHistory'] != false;

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
    id: '${json['id'] ?? ''}', name: '${json['name'] ?? 'Cresa Reader'}', identifier: '${json['identifier'] ?? ''}', role: UserRole.values.firstWhere((value) => value.name == json['role'], orElse: () => UserRole.student), identifierType: json['identifierType'] == 'lecturer_id' ? IdentifierType.lecturerId : IdentifierType.registrationNumber, lecturerEmail: json['lecturerEmail'] as String?, status: json['status'] as String?, signedIn: json['signedIn'] == true, verified: json['verified'] != false, profile: Map<String, dynamic>.from(json['profile'] as Map? ?? {}),
  );
}

class ResourceItem {
  const ResourceItem({required this.id, required this.title, required this.author, required this.kind, required this.description, required this.format, required this.downloadUrl, this.courseCode = '', this.fileSize = '', this.saved = false});
  final int id;
  final String title;
  final String author;
  final String kind;
  final String description;
  final String format;
  final String downloadUrl;
  final String courseCode;
  final String fileSize;
  final bool saved;

  factory ResourceItem.fromJson(Map<String, dynamic> json) => ResourceItem(id: int.tryParse('${json['id']}') ?? 0, title: '${json['title'] ?? ''}', author: '${json['author'] ?? ''}', kind: '${json['resourceType'] ?? 'Resource'}', description: '${json['description'] ?? ''}', format: '${json['resourceType'] ?? 'PDF'}', downloadUrl: '${json['filePath'] ?? ''}', courseCode: '${json['course'] ?? ''}', fileSize: '${json['fileSizeBytes'] ?? ''}');
}

class CommunityComment {
  const CommunityComment({required this.id, required this.name, required this.initials, required this.content, required this.createdAt});
  final String id;
  final String name;
  final String initials;
  final String content;
  final DateTime createdAt;

  factory CommunityComment.fromJson(Map<String, dynamic> json) => CommunityComment(id: '${json['id']}', name: '${json['author']?['name'] ?? 'Reader'}', initials: '${json['author']?['initials'] ?? 'R'}', content: '${json['content'] ?? ''}', createdAt: DateTime.tryParse('${json['createdAt']}') ?? DateTime.now());
}

class CommunityPost {
  const CommunityPost({required this.id, required this.name, required this.initials, required this.content, required this.tags, required this.createdAt, required this.reactions, required this.reacted, required this.comments});
  final String id;
  final String name;
  final String initials;
  final String content;
  final List<String> tags;
  final DateTime createdAt;
  final int reactions;
  final bool reacted;
  final List<CommunityComment> comments;

  factory CommunityPost.fromJson(Map<String, dynamic> json) => CommunityPost(id: '${json['id']}', name: '${json['author']?['name'] ?? 'Reader'}', initials: '${json['author']?['initials'] ?? 'R'}', content: '${json['content'] ?? ''}', tags: List<String>.from(json['tags'] as List? ?? const []), createdAt: DateTime.tryParse('${json['createdAt']}') ?? DateTime.now(), reactions: (json['reactions'] as num?)?.toInt() ?? 0, reacted: json['reacted'] == true, comments: (json['comments'] as List? ?? const []).map((item) => CommunityComment.fromJson(Map<String, dynamic>.from(item as Map))).toList());
}

class NotificationItem {
  const NotificationItem({required this.id, required this.type, required this.message, required this.createdAt, this.readAt});
  final String id;
  final String type;
  final String message;
  final DateTime createdAt;
  final DateTime? readAt;

  factory NotificationItem.fromJson(Map<String, dynamic> json) => NotificationItem(id: '${json['id']}', type: '${json['type']}', message: '${json['message']}', createdAt: DateTime.tryParse('${json['createdAt']}') ?? DateTime.now(), readAt: json['readAt'] == null ? null : DateTime.tryParse('${json['readAt']}'));
}
