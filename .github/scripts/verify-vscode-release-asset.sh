#!/usr/bin/env bash

set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "${script_directory}/../.." && pwd)"
manifest_file="${repository_root}/vscode/package.json"
lock_file="${repository_root}/vscode/package-lock.json"

read_json_version() {
  node -e 'const fs = require("node:fs"); const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(data.version ?? "");' "$1"
}

configured_version="$(read_json_version "${manifest_file}")"
lock_version="$(read_json_version "${lock_file}")"
lock_package_version="$(node -e 'const fs = require("node:fs"); const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(data.packages?.[""]?.version ?? "");' "${lock_file}")"
expected_version="${1:-${configured_version}}"

if [[ -z "${configured_version}" ]]; then
  echo "::error::version is missing from vscode/package.json."
  exit 1
fi

if [[ ! "${configured_version}" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  echo "::error::The VS Code extension version must use the exact MAJOR.MINOR.PATCH form."
  exit 1
fi

if [[ "${expected_version}" != "${configured_version}" ]]; then
  echo "::error::Expected extension version ${expected_version}, but package.json is configured for ${configured_version}."
  exit 1
fi

if [[ "${lock_version}" != "${configured_version}" || "${lock_package_version}" != "${configured_version}" ]]; then
  echo "::error::vscode/package-lock.json versions ${lock_version:-<missing>} and ${lock_package_version:-<missing>} must both match package.json version ${configured_version}."
  exit 1
fi

archive_name="agent-helper-${configured_version}.vsix"
archive_path="${repository_root}/vscode/${archive_name}"
relative_archive_path="vscode/${archive_name}"

if [[ ! -f "${archive_path}" ]]; then
  echo "::error::Expected installable VSIX at ${relative_archive_path}."
  exit 1
fi

if ! unzip -tq "${archive_path}" >/dev/null; then
  echo "::error::The release VSIX is corrupt: ${relative_archive_path}."
  exit 1
fi

packaged_version="$(unzip -p "${archive_path}" extension/package.json | node -e 'const fs = require("node:fs"); const data = JSON.parse(fs.readFileSync(0, "utf8")); process.stdout.write(data.version ?? "");')"
if [[ "${packaged_version}" != "${configured_version}" ]]; then
  echo "::error::The VSIX contains extension version ${packaged_version:-<missing>}, expected ${configured_version}."
  exit 1
fi

echo "Verified installable VS Code extension VSIX: ${relative_archive_path}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "path=${relative_archive_path}" >>"${GITHUB_OUTPUT}"
  echo "version=${configured_version}" >>"${GITHUB_OUTPUT}"
fi
