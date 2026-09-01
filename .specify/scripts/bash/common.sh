#!/usr/bin/env bash
# Common functions and variables for all scripts

# Valid branch types for git workflow
VALID_BRANCH_TYPES="feat|fix|docs|refactor|test|chore"

# Get repository root, with fallback for non-git repositories
get_repo_root() {
    if git rev-parse --show-toplevel >/dev/null 2>&1; then
        git rev-parse --show-toplevel
    else
        # Fall back to script location for non-git repos
        local script_dir="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        (cd "$script_dir/../../.." && pwd)
    fi
}

# Get current branch, with fallback for non-git repositories
get_current_branch() {
    # First check if SPECIFY_FEATURE environment variable is set
    if [[ -n "${SPECIFY_FEATURE:-}" ]]; then
        echo "$SPECIFY_FEATURE"
        return
    fi

    # Then check git if available
    if git rev-parse --abbrev-ref HEAD >/dev/null 2>&1; then
        git rev-parse --abbrev-ref HEAD
        return
    fi

    # For non-git repos, try to find the latest feature directory by modification time
    local repo_root=$(get_repo_root)
    local specs_dir="$repo_root/specs"

    if [[ -d "$specs_dir" ]]; then
        # Find the most recently modified directory
        local latest_feature=""
        latest_feature=$(ls -t "$specs_dir" 2>/dev/null | head -1)
        
        if [[ -n "$latest_feature" && -d "$specs_dir/$latest_feature" ]]; then
            echo "feat/$latest_feature"
            return
        fi
    fi

    echo "main"  # Final fallback
}

# Check if we have git available
has_git() {
    git rev-parse --show-toplevel >/dev/null 2>&1
}

# Extract feature short name from branch
# Handles formats: <type>/<name>, <type>/CU-<id>-<name>, or just <name>
extract_feature_name() {
    local branch="$1"
    local name=""
    
    # Pattern: <type>/CU-<taskid>-<name>
    if [[ "$branch" =~ ^($VALID_BRANCH_TYPES)/CU-[^-]+-(.+)$ ]]; then
        name="${BASH_REMATCH[2]}"
    # Pattern: <type>/<name>
    elif [[ "$branch" =~ ^($VALID_BRANCH_TYPES)/(.+)$ ]]; then
        name="${BASH_REMATCH[2]}"
    else
        # Fallback: use branch name as-is (for compatibility)
        name="$branch"
    fi
    
    echo "$name"
}

check_feature_branch() {
    local branch="$1"
    local has_git_repo="$2"

    # For non-git repos, we can't enforce branch naming but still provide output
    if [[ "$has_git_repo" != "true" ]]; then
        echo "[specify] Warning: Git repository not detected; skipped branch validation" >&2
        return 0
    fi

    # Check for valid branch format: <type>/<name> or <type>/CU-<id>-<name>
    if [[ ! "$branch" =~ ^($VALID_BRANCH_TYPES)/ ]]; then
        echo "ERROR: Not on a feature branch. Current branch: $branch" >&2
        echo "Feature branches should be named like: feat/feature-name or feat/CU-taskid-feature-name" >&2
        echo "Valid types: feat, fix, docs, refactor, test, chore" >&2
        return 1
    fi

    return 0
}

get_feature_dir() { echo "$1/specs/$2"; }

# Find feature directory from branch name
# Extracts the short name and looks for matching directory
find_feature_dir_by_branch() {
    local repo_root="$1"
    local branch_name="$2"
    local specs_dir="$repo_root/specs"

    # Extract feature name from branch (handles all formats)
    local feature_name=$(extract_feature_name "$branch_name")
    
    # Check if directory exists
    if [[ -d "$specs_dir/$feature_name" ]]; then
        echo "$specs_dir/$feature_name"
        return
    fi
    
    # If not found, return the expected path (will fail later with clear error)
    echo "$specs_dir/$feature_name"
}

# Legacy function - kept for backward compatibility, redirects to new function
find_feature_dir_by_prefix() {
    find_feature_dir_by_branch "$@"
}

get_feature_paths() {
    local repo_root=$(get_repo_root)
    local current_branch=$(get_current_branch)
    local has_git_repo="false"

    if has_git; then
        has_git_repo="true"
    fi

    # Use branch-based lookup to find feature directory
    local feature_dir=$(find_feature_dir_by_branch "$repo_root" "$current_branch")

    cat <<EOF
REPO_ROOT='$repo_root'
CURRENT_BRANCH='$current_branch'
HAS_GIT='$has_git_repo'
FEATURE_DIR='$feature_dir'
FEATURE_SPEC='$feature_dir/spec.md'
IMPL_PLAN='$feature_dir/plan.md'
TASKS='$feature_dir/tasks.md'
RESEARCH='$feature_dir/research.md'
DATA_MODEL='$feature_dir/data-model.md'
QUICKSTART='$feature_dir/quickstart.md'
CONTRACTS_DIR='$feature_dir/contracts'
EOF
}

check_file() { [[ -f "$1" ]] && echo "  ✓ $2" || echo "  ✗ $2"; }
check_dir() { [[ -d "$1" && -n $(ls -A "$1" 2>/dev/null) ]] && echo "  ✓ $2" || echo "  ✗ $2"; }
