import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/responsive.dart';
import '../../../dashboard/presentation/widgets/sidebar_widget.dart';

class TaskManagerPage extends StatelessWidget {
  const TaskManagerPage({super.key});

  @override
  Widget build(BuildContext context) {
    final isMobile = Responsive.isMobile(context);
    return Scaffold(
      backgroundColor: AppTheme.primaryLight,
      drawer: isMobile ? const AppDrawer() : null,
      bottomNavigationBar: isMobile ? const AppBottomNav() : null,
      body: Row(children: [
        const SidebarWidget(),
        Expanded(child: Column(children: [
          if (isMobile)
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 20, 8, 0),
              child: Row(children: [
                Builder(builder: (ctx) => IconButton(
                  icon: const Icon(Icons.menu,
                      color: Color(0xFF1A1A2E)),
                  onPressed: () => Scaffold.of(ctx).openDrawer(),
                )),
                const Text('Task Manager',
                    style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1A1A2E))),
              ]),
            ),
          Expanded(child: Center(
              child: Text('Task Manager',
                  style: Theme.of(context).textTheme.displayMedium))),
        ])),
      ]),
    );
  }
}