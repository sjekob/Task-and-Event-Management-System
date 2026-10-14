import 'package:flutter/material.dart';
import '../services/api_service.dart';

/// A person's round avatar: their profile photo when they have one, otherwise
/// their initials. Falls back to the initials if the photo can't load.
class UserAvatar extends StatelessWidget {
  final String? avatarUrl;
  final String initials;
  final double radius;
  final Color backgroundColor;
  final TextStyle? textStyle;

  const UserAvatar({
    super.key,
    required this.avatarUrl,
    required this.initials,
    this.radius = 20,
    required this.backgroundColor,
    this.textStyle,
  });

  @override
  Widget build(BuildContext context) {
    final url = ApiService.mediaUrl(avatarUrl);
    return CircleAvatar(
      radius: radius,
      backgroundColor: backgroundColor,
      foregroundImage: url != null ? NetworkImage(url) : null,
      onForegroundImageError: url != null ? (_, __) {} : null,
      child: Text(
        initials,
        style: textStyle ??
            TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: radius * 0.75),
      ),
    );
  }
}
