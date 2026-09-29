import 'package:flutter/material.dart';

class CresaTheme {
  static const navy = Color(0xff102c68);
  static const blue = Color(0xff3477e7);
  static const ink = Color(0xff18345f);
  static const muted = Color(0xff7185a7);
  static const surface = Color(0xfff6f9ff);

  static ThemeData light() => ThemeData(useMaterial3: true, scaffoldBackgroundColor: surface, colorScheme: ColorScheme.fromSeed(seedColor: blue, brightness: Brightness.light), fontFamily: 'Arial', appBarTheme: const AppBarTheme(backgroundColor: surface, foregroundColor: ink, elevation: 0), inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(12)), borderSide: BorderSide(color: Color(0xffdce8f8))), enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(12)), borderSide: BorderSide(color: Color(0xffdce8f8))), focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(12)), borderSide: BorderSide(color: blue, width: 1.5)), contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 13)), cardTheme: const CardThemeData(color: Colors.white, elevation: 0, margin: EdgeInsets.zero, shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(18)), side: BorderSide(color: Color(0xffe0eafa))));
}

class CresaLogo extends StatelessWidget {
  const CresaLogo({super.key, this.size = 42});
  final double size;
  @override
  Widget build(BuildContext context) => ClipOval(child: Image.asset('assets/cresa_logo.png', width: size, height: size, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(width: size, height: size, color: const Color(0xffd5eaff), alignment: Alignment.center, child: Text('C', style: TextStyle(fontSize: size * .52, fontWeight: FontWeight.w800, color: CresaTheme.navy)))));
}

class CresaCard extends StatelessWidget {
  const CresaCard({super.key, required this.child, this.padding = const EdgeInsets.all(18)});
  final Widget child;
  final EdgeInsets padding;
  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: padding, child: child));
}
