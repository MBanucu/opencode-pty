---
description: Create comprehensive session report and refactor docs
---

# Create Session Report and Refactor Documentation

This command analyzes the current coding session documentation in `.opencode/docs` and creates a comprehensive report about lessons learned. It then integrates this report into the documentation structure by updating existing documents or creating new ones as needed, refactors the file organization if necessary, updates outdated content, removes redundant information, and ensures minimal duplication.

## Steps to Execute

1. **Analyze Current Documentation Structure**
   - Read all files in `.opencode/docs` and subdirectories
   - Identify key themes, lessons learned, and case studies
   - Note any duplicated content or outdated information
   - Assess the current organization and identify improvement opportunities
   - Determine the best way to integrate lessons learned (update existing docs vs create new ones)
   - **Check file lengths**: Identify files longer than 150 lines that could benefit from splitting

2. **Integrate Lessons Learned Content**
   - Review existing documentation to identify where lessons learned fit best
   - Update existing files with new lessons learned content where appropriate
   - Create new documentation files only if no suitable existing document exists for a specific topic
   - Ensure comprehensive coverage without creating redundant files
   - Prioritize updating index/overview files with key insights

3. **Refactor File Structure**
   - Evaluate if the current organization (typescript/, test/, etc.) is optimal
   - Create new directories or reorganize existing ones if needed
   - Update any cross-references between files
   - Ensure logical grouping of related content
   - **Split long files**: For files exceeding 150 lines, split them into logical smaller files while maintaining clear navigation

4. **Update and Clean Content**
   - Review all documentation files for outdated information
   - Remove duplicate sections and consolidate similar content
   - Update any references to old practices or deprecated approaches
   - Ensure all examples are current and relevant

5. **Integrate and Finalize**
   - Ensure all lessons learned are properly documented in appropriate locations
   - Update index files and navigation references
   - Run quality checks (linting, formatting) on all modified files
   - Ensure the documentation maintains consistency and clarity

## Deliverables

- Lessons learned integrated into existing documentation or new appropriate files created
- Refactored documentation structure (if changes made)
- Long files split into manageable pieces (target: <150 lines per file)
- Updated content with reduced duplication
- All files properly formatted and checked for quality
