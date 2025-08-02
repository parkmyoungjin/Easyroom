# Archived Specs

This directory contains spec files that have been archived during code architecture cleanup.

## Archive Date
2025-07-29T12:07:07.878Z

## Archived Specs



## Restoration Process

To restore an archived spec:

1. **Copy the spec directory back to its original location**:
   ```bash
   cp -r .kiro/specs/archived/[spec-name] .kiro/specs/[spec-name]
   ```

2. **Remove the ARCHIVE_INFO.md file**:
   ```bash
   rm .kiro/specs/[spec-name]/ARCHIVE_INFO.md
   ```

3. **Complete any missing files** (design.md, tasks.md) if needed

4. **Update the spec content** to match current codebase if necessary

## Archive Criteria

Specs were archived if they met one or more of these criteria:
- Incomplete (missing design.md and/or tasks.md files)
- Low relevance score (< 40 points)
- Implementation appears to be completed
- Outdated or no longer applicable

## Maintenance

This archive should be reviewed periodically:
- Remove specs that are definitely no longer needed (after 6+ months)
- Restore specs that become relevant again
- Update this README when specs are added or removed
