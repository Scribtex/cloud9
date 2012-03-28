/**
 * Main IDE object for the Ajax.org Cloud IDE
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
 
define(function(require, exports, module) {
    var Document = require("core/document");
    var util = require("core/util");
    
    var ide = new apf.Class().$init();

    ide.createDocument = function(node, value){
        return new Document(node, value);
    };

    ide.start = function() {
        //Set references to global elements - aka extension points
        //this.tbMain       = tbMain;
        this.mnuFile        = mnuFile;
        this.mnuEdit        = mnuEdit;
        //this.barMenu      = barMenu;
        this.barTools       = barTools;
        this.sbMain         = sbMain;
        this.vbMain         = vbMain;

        this.workspaceDir   = window.cloud9config.workspaceDir.replace(/\/+$/, "");
        this.davPrefix      = window.cloud9config.davPrefix.replace(/\/+$/, "");
        this.staticPrefix   = window.cloud9config.staticUrl;
        this.sessionId      = window.cloud9config.sessionId;
        this.workspaceId    = window.cloud9config.workspaceId;
        this.readonly       = window.cloud9config.readonly;
        this.projectName    = window.cloud9config.projectName;

        this.loggedIn       = true;
            //Set references to global elements - aka extension points
            //this.tbMain       = tbMain;
            this.mnuFile        = mnuFile;
            this.mnuEdit        = mnuEdit;
            //this.barMenu      = barMenu;
            this.barTools       = barTools;
            this.sbMain         = sbMain;
            this.vbMain         = vbMain;

        this.onLine         = false;
        this.offlineFileSystemSupport = false;

        this.dispatchEvent("load");

        /**** Error Handling ****/

        //Catch all unhandled errors
        var loc = location.href;
        if (
            location.protocol != "file:"
            && loc.indexOf("dev") == -1
            && (loc.indexOf("cloud9ide.com") > -1 || loc.indexOf("c9.io") > -1))
        {
            window.onerror = function(m, u, l) {
                if (self.console)
                    console.log("An error occurred, the Cloud9 system admin has been notified.");
                apf.ajax("/debug", {
                    method      : "POST",
                    contentType : "application/json",
                    data        : apf.serialize({
                        agent       : navigator.userAgent,
                        type        : "General Javascript Error",
                        e           : [m, u, l],
                        workspaceId : ide.workspaceId
                    })
                });
                return true;
            };

            //Catch all APF Routed errors
            apf.addEventListener("error", function(e){
                apf.ajax("/debug", {
                    method      : "POST",
                    contentType : "application/json",
                    data        : apf.serialize({
                        agent       : navigator.userAgent,
                        type        : "APF Error",
                        message     : e.message,
                        tgt         : e.currentTarget && e.currentTarget.serialize(),
                        url         : e.url,
                        state       : e.state,
                        e           : e.error,
                        workspaceId : ide.workspaceId
                    })
                });
            });
        }
        else {
//                window.onerror = function(m, u, l) {
//                    self.console && console.error("An error occurred", m, u, l);
//                }
            apf.addEventListener("error", function(e){
                self.console && console.error("An APF error occurred", e);
            });
        }
    };

    apf.addEventListener("load", function(){
        ide.start();
    });
    
    //@todo this doesnt work
    apf.addEventListener("exit", function(){
        //return "Are you sure you want to close Cloud9? Your state will be saved and will be loaded next time you start Cloud9";
    });

    
    ide.getActivePageModel = function() {
        var page = tabEditors.getPage();
        if (!page)
            return null;

        return page.$model.data;
    };
    
    ide.getAllPageModels = function() {
        return tabEditors.getPages().map(function(page) {
            return page.$model.data;
        });
    };

    module.exports = ide;
});
