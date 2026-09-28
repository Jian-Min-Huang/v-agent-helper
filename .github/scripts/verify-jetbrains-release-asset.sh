#!/usr/bin/env bash

set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "${script_directory}/../.." && pwd)"
properties_file="${repository_root}/jetbrains/gradle.properties"

configured_version="$(sed -n 's/^pluginVersion=//p' "${properties_file}")"
expected_version="${1:-${configured_version}}"

if [[ -z "${configured_version}" ]]; then
  echo "::error::pluginVersion is missing from jetbrains/gradle.properties."
  exit 1
fi

if [[ "${expected_version}" != "${configured_version}" ]]; then
  echo "::error::Expected plugin version ${expected_version}, but Gradle is configured for ${configured_version}."
  exit 1
fi

if [[ ! "${configured_version}" =~ ^[0-9A-Za-z][0-9A-Za-z._-]*$ ]]; then
  echo "::error::pluginVersion contains characters that are unsafe in a release filename."
  exit 1
fi

distribution_directory="${repository_root}/jetbrains/build/distributions"
archive_name="v-codex-helper-${configured_version}.zip"
archive_path="${distribution_directory}/${archive_name}"
relative_archive_path="jetbrains/build/distributions/${archive_name}"

shopt -s nullglob
archives=("${distribution_directory}"/*.zip)
shopt -u nullglob

if [[ "${#archives[@]}" -ne 1 || "${archives[0]:-}" != "${archive_path}" ]]; then
  echo "::error::Expected exactly one installable ZIP at ${relative_archive_path}."
  exit 1
fi

if ! unzip -tq "${archive_path}" >/dev/null; then
  echo "::error::The release ZIP is corrupt: ${relative_archive_path}."
  exit 1
fi

archive_entries="$(unzip -Z1 "${archive_path}")"
if ! grep -Fxq "v-codex-helper/" <<<"${archive_entries}" ||
  ! grep -Fxq "v-codex-helper/lib/v-codex-helper-${configured_version}.jar" <<<"${archive_entries}"; then
  echo "::error::The release ZIP does not contain the expected installable plugin layout."
  exit 1
fi

echo "Verified installable JetBrains plugin ZIP: ${relative_archive_path}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "path=${relative_archive_path}" >>"${GITHUB_OUTPUT}"
  echo "version=${configured_version}" >>"${GITHUB_OUTPUT}"
fi
