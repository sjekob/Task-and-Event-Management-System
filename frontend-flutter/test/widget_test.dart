import 'package:flutter_test/flutter_test.dart';
import 'package:tasknet/main.dart';

void main() {
  testWidgets('Login screen renders', (WidgetTester tester) async {
    await tester.pumpWidget(const TaskNetApp());
    expect(find.text('TaskNet'), findsOneWidget);
    expect(find.text('Naga Central School II'), findsOneWidget);
    expect(find.text('Sign In'), findsOneWidget);
  });
}
