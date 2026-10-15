import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/services/api_service.dart';

// ─── Events ──────────────────────────────────────────────────────────────────
abstract class AuthEvent extends Equatable {
  const AuthEvent();
  @override
  List<Object?> get props => [];
}

class LoginSubmitted extends AuthEvent {
  final String username;
  final String password;
  const LoginSubmitted({required this.username, required this.password});
  @override
  List<Object?> get props => [username, password];
}

class LogoutRequested extends AuthEvent {}

// ─── States ──────────────────────────────────────────────────────────────────
abstract class AuthState extends Equatable {
  const AuthState();
  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {}

class AuthLoading extends AuthState {}

class AuthSuccess extends AuthState {
  final String username;
  const AuthSuccess({required this.username});
  @override
  List<Object?> get props => [username];
}

class AuthFailure extends AuthState {
  final String message;
  const AuthFailure({required this.message});
  @override
  List<Object?> get props => [message];
}

// ─── Bloc ─────────────────────────────────────────────────────────────────────
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc() : super(AuthInitial()) {
    on<LoginSubmitted>(_onLoginSubmitted);
    on<LogoutRequested>(_onLogoutRequested);
  }

  Future<void> _onLoginSubmitted(
    LoginSubmitted event, Emitter<AuthState> emit) async {
  emit(AuthLoading());
  try {
    final result = await ApiService.login(
      event.username,
      event.password,
    );
    if (result['success'] == true) {
      emit(AuthSuccess(username: event.username));
    } else {
      emit(AuthFailure(
          message: result['message'] ?? 'Login failed'));
    }
  } catch (e) {
    emit(AuthFailure(message: 'Connection error. Is the server running?'));
  }
}

  void _onLogoutRequested(LogoutRequested event, Emitter<AuthState> emit) {
    emit(AuthInitial());
  }
}
