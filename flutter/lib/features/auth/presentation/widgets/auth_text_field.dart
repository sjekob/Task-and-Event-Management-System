import 'package:flutter/material.dart';

class AuthTextField extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode? focusNode;
  final String hint;
  final bool obscureText;
  final Widget? suffixIcon;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onFieldSubmitted;
  final FormFieldValidator<String>? validator;

  const AuthTextField({
    super.key,
    required this.controller,
    this.focusNode,
    required this.hint,
    this.obscureText = false,
    this.suffixIcon,
    this.textInputAction,
    this.onFieldSubmitted,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      focusNode: focusNode,
      obscureText: obscureText,
      textInputAction: textInputAction,
      onFieldSubmitted: onFieldSubmitted,
      validator: validator,
      style: const TextStyle(fontSize: 14, color: Color(0xFF1A1A2E)),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFFAAAAAA), fontSize: 14),
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        suffixIcon: suffixIcon,
        suffixIconConstraints:
            const BoxConstraints(minWidth: 44, minHeight: 44),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide.none),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide.none),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFFACC2DF), width: 1.5)),
        errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFFE57373), width: 1.2)),
        focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFFE57373), width: 1.5)),
        errorStyle: const TextStyle(fontSize: 11, color: Color(0xFFD32F2F)),
      ),
    );
  }
}
