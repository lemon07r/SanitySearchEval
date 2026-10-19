# Deploy status CLI

renderStatus(argv, label) returns the status line for a successful deployment.
Colors are on by default; --no-color disables them and --color enables them.
--quiet suppresses the line. --tag appends an optional deployment tag. argv is the
user-argument array, without the node executable or script name. Node 22.12+ / Bun.
