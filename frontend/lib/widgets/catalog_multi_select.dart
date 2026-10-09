import 'package:flutter/material.dart';

/// One pickable catalog entry (a skill or a certification).
class CatalogOption {
  final String name;
  final String? group;  // category header it is listed under
  final String? detail; // secondary line, e.g. the certification's issuer
  const CatalogOption(this.name, {this.group, this.detail});
}

/// Multi-select dropdown over a fixed catalog: entries are listed under their
/// category headers, each pick is added as a removable chip, and entries
/// already picked drop out of the list. There is no free-text entry.
class CatalogMultiSelect extends StatelessWidget {
  final String label;
  final List<String> selected;
  final List<CatalogOption> options;
  final InputDecoration decoration;
  final ValueChanged<List<String>> onChanged;

  const CatalogMultiSelect({
    super.key,
    required this.label,
    required this.selected,
    required this.options,
    required this.decoration,
    required this.onChanged,
  });

  List<DropdownMenuItem<String>> _items() {
    final taken = selected.map((e) => e.toLowerCase()).toSet();
    final groups = <String, List<CatalogOption>>{};
    for (final o in options) {
      if (taken.contains(o.name.toLowerCase())) continue;
      groups.putIfAbsent(o.group ?? 'Other', () => []).add(o);
    }
    return [
      for (final entry in groups.entries) ...[
        DropdownMenuItem<String>(
          enabled: false,
          value: null,
          child: Text(entry.key.toUpperCase(),
              style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF94A3B8),
                  letterSpacing: 0.5)),
        ),
        for (final o in entry.value)
          DropdownMenuItem<String>(
            value: o.name,
            child: Padding(
              padding: const EdgeInsets.only(left: 10, top: 4, bottom: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(o.name,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 14)),
                  if (o.detail != null)
                    Text(o.detail!,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 11, color: Colors.grey.shade600)),
                ],
              ),
            ),
          ),
      ],
    ];
  }

  @override
  Widget build(BuildContext context) {
    final items = _items();
    final remaining = items.where((i) => i.value != null).length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          // New key after each pick so the field resets to the hint.
          key: ValueKey('$label-${selected.length}-${options.length}'),
          isExpanded: true,
          itemHeight: null,
          menuMaxHeight: 360,
          decoration: decoration.copyWith(labelText: label),
          hint: Text(
            options.isEmpty
                ? 'Loading list...'
                : remaining == 0
                    ? 'All ${label.toLowerCase()} added'
                    : 'Select to add',
            style: const TextStyle(fontSize: 14),
          ),
          items: items,
          onChanged: remaining == 0
              ? null
              : (v) {
                  if (v != null) onChanged([...selected, v]);
                },
        ),
        if (selected.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final item in selected)
                InputChip(
                  label: Text(item, style: const TextStyle(fontSize: 12)),
                  backgroundColor: const Color(0xFFEFF4FA),
                  side: const BorderSide(color: Color(0xFFD0DCEB)),
                  visualDensity: VisualDensity.compact,
                  onDeleted: () =>
                      onChanged(selected.where((e) => e != item).toList()),
                ),
            ],
          ),
        ],
      ],
    );
  }
}
