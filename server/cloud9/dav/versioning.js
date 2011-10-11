var jsDAV_ServerPlugin = require("DAV/plugin").jsDAV_ServerPlugin;
var sys = require("sys");
var Spawn = require("child_process").spawn;

Git = function(path) {
    this.path = path;
};

(function() {

    this.add    = function(path, onError, onSuccess) {
        this.$runCommand(["git", "add", path], onError, onSuccess);
    };
    this.commit = function(message, onError, onSuccess) {
        this.$runCommand(["git", "commit", "-m", message], onError, onSuccess);
    };
    this.rm_r   = function(path, onError, onSuccess) {
        this.$runCommand(["git", "rm", "-r", path], onError, onSuccess);
    };

    this.$runCommand = function(argv, onError, onSuccess) {
        var cmd  = argv[0],
            args = argv.slice(1);

        var child = Spawn(cmd, args || [], {
            cwd: this.path
        });

        var out   = "";
        var err   = "";
        var self = this;

        child.stdout.on("data", function(data) {
            out += data.toString("utf8");
        });
        child.stderr.on("data", function(data) {
            err += data.toString("utf8");
        });

        child.on("exit", function(code) {
            if (code != 0) {
                if (typeof onError === "function")
                    onError(code, err, out);
            } else {
                if (typeof onSuccess === "function")
                    onSuccess(code, err, out);
            }
        });

        return child;
    };

}).call(Git.prototype);

module.exports = AutoGit = function(handler) {
    jsDAV_ServerPlugin.call(this, handler);
    
    this.handler = handler;
    this.git     = new Git(this.handler.server.options.path);
    
    handler.addEventListener("afterCreateFile", this.afterCreate.bind(this));
    handler.addEventListener("afterWriteContent", this.afterSave.bind(this));
    handler.addEventListener("afterUnbind", this.afterDelete.bind(this));
    handler.addEventListener("afterMove", this.afterMove.bind(this));
    handler.addEventListener("afterCopy", this.afterCopy.bind(this));
};

sys.inherits(AutoGit, jsDAV_ServerPlugin);

(function() {

    this.afterCreate = function(e, path) {
        var self = this;
        this.git.add(
            path,
            self.$onError,
            function(code, err, out) {
                self.git.commit(
                    "Created " + path,
                    self.$onError,
                    null
                );
            }
        );
    };

    this.afterSave = function(e, path) {
        var self = this;
        this.git.add(
            path,
            self.$onError,
            function(code, err, out) {
                self.git.commit(
                    "Updated " + path,
                    self.$onError,
                    null
                );
            }
        );
    };

    this.afterDelete = function(e, path) {
        var self = this;
        this.git.rm_r(
            path,
            self.$onError,
            function(code, err, out) {
                self.git.commit(
                    "Deleted " + path,
                    self.$onError,
                    null
                );
            }
        );
    };

    this.afterMove = function(e, source, destination) {
        var self = this;
        this.git.rm_r(
            source,
            self.$onError,
            function(code, err, out) {
                self.git.add(
                    destination,
                    self.$onError,
                    function(code, err, out) {
                        self.git.commit(
                            "Moved " + source + " to " + destination,
                            self.$onError,
                            null
                        );
                    }
                );
            }
        );
    };

    this.afterCopy = function(e, source, destination) {
        var self = this;
        this.git.add(
            destination,
            self.$onError,
            function(code, err, out) {
                self.git.commit(
                    "Copied " + source + " to " + destination,
                    self.$onError,
                    null
                );
            }
        );
    };

    this.$onError = function(code, err, out) {
        console.log("Bugger!", err);
    }

}).call(AutoGit.prototype);
