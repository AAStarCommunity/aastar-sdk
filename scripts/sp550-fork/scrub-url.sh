# Sourced by run-a7.sh and setup-fork.sh (Daybreak #468 re-run: the fork URL must not reach anvil.log / deploy.log).
# scrub_log copies stdin to stdout with every form of $FORK_URL replaced by <fork-url>, using bash's own pattern
# substitution: no child process ever holds the URL (not sed / awk, whose argv or env would carry it). Forms: the URL
# as given, without its scheme, without a trailing slash, and its path + query alone (where a key usually sits).
scrub_log() {
  # Each form in its own variable: bash 3.2 cannot nest an expansion inside a substitution pattern.
  local u="${FORK_URL:-}" trimmed noscheme pathq line
  trimmed="${u%/}"
  noscheme="${u#*://}"; noscheme="${noscheme%/}"
  pathq="/${noscheme#*/}"; [ "$pathq" = "/$noscheme" ] && pathq=""
  while IFS= read -r line || [ -n "$line" ]; do
    if [ -n "$u" ]; then
      line="${line//"$u"/<fork-url>}"; line="${line//"$trimmed"/<fork-url>}"; line="${line//"$noscheme"/<fork-url>}"
      if [ ${#pathq} -ge 8 ]; then line="${line//"$pathq"/<fork-url-path>}"; fi
    fi
    printf '%s\n' "$line"
  done
}
