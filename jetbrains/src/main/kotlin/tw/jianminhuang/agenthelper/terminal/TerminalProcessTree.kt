package tw.jianminhuang.agenthelper.terminal

/** Returns the command lines of a terminal's root process and its live descendants. */
internal fun terminalProcessCommands(rootPid: Long?): List<String> {
    if (rootPid == null || rootPid <= 0) return emptyList()

    return try {
        val root = ProcessHandle.of(rootPid).orElse(null) ?: return emptyList()
        buildList {
            root.commandLineOrCommand()?.let(::add)
            val descendants = root.descendants()
            try {
                descendants.forEach { process -> process.commandLineOrCommand()?.let(::add) }
            } finally {
                descendants.close()
            }
        }
    } catch (_: SecurityException) {
        emptyList()
    }
}

private fun ProcessHandle.commandLineOrCommand(): String? {
    val info = info()
    return info.commandLine().orElseGet { info.command().orElse(null) }
}
