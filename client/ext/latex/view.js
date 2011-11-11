define(function(require, exports, modules) {

    var logParser = require("ext/latex/log_parser");
    var settings  = require("ext/settings/settings");
    var ide       = require("core/ide");

    var View = function() {};

    (function() {
        this.init = function(controller) {
            this.controller = controller;
            var self = this;
            ide.addEventListener("loadsettings", function(e) {
                self.$setView();
                self.$addTabs();
                self.$initViewMenu();
            });
        };

        this.$setView = function() {
            var node = settings.model.queryNode("latex/view");
            if (node) {
                this.view = node.getAttribute("style");
            }
            if (this.view != "sideBySide" && this.view != "tabbed") {
                this.view = "sideBySide"
                settings.model.setQueryValue("latex/view/@style", this.view);
            }
        };

        this.$isSideBySide = function() {
            return this.view == "sideBySide";
        };

        this.$isTabbed = function() {
            return this.view == "tabbed";
        };

        this.$addTabs = function() {
            var self = this;

            this.tabBar = new apf.bar({
                skinset  : "latex",
                skin     : "basic",
                style    : "padding : 0 0 33px 0;position:absolute;", //53px
                htmlNode : document.body,
                childNodes: [
                    new apf.tab({
                        id       : "tabOutput",
                        skin     : "pdf_tab",
                        style    : "height : 100%;",
                        buttons  : ""
                    })
                ]
            });

            this.logContent = logContent;
            logContent.removeNode();
        
            // This is a patch to fix my lack of understanding as to why the content 
            // of the tabs is not always correctly resized to the size of the page
            tabOutput.addEventListener("afterswitch", function(e) {
                window.onresize();
            });

            // The PDF isn't actually part of the DOM of the tab pane. Instead we 
            // position in the right place whenever the tab is visible and hide it
            // when the tab is not visible.
            tabOutput.addEventListener("afterswitch", function(e) {
                if (e.nextPage.name == "pdfPage") {
                    self.$showPdf();
                }
                if (e.previousPage && e.previousPage.name == "pdfPage") {
                    self.$hidePdf();
                }
            });
           
            if (this.$isSideBySide()) {
                this.$initSideBySideTabs();
            } else {
                this.$initSinglePaneTabs();
            }
       };
        
       this.$initViewMenu = function() {
            mnuView.appendChild(new apf.item({
                caption : "Pdf View",
                submenu : "mnuPdfView"
            }));
            apf.document.body.appendChild(new apf.menu({
                id : "mnuPdfView"
            }));

            var self = this;
            mnuPdfView.appendChild(this.itmSideBySide = new apf.item({
                caption  : "Side by side",
                type     : "radio",
                selected : this.$isSideBySide(),
                onclick  : function() {
                    self.$setViewToSideBySide();
                }
            }));
            mnuPdfView.appendChild(this.itmSinglePane = new apf.item({
                caption  : "Tabbed",
                type     : "radio",
                selected : this.$isTabbed(),
                onclick  : function() {
                    self.$setViewToTabbed();
                }
            }));
        };

        this.$setViewToSideBySide = function() {
            this.view = "sideBySide"
            settings.model.setQueryValue("latex/view/@style", this.view);
            this.$destroySinglePaneTabs();
            this.$initSideBySideTabs();
            this.initOutputTabs();
        };

        this.$setViewToTabbed = function() {
            this.view = "tabbed"
            settings.model.setQueryValue("latex/view/@style", this.view);
            this.$destroySideBySideTabs();
            this.$initSinglePaneTabs();
            this.initOutputTabs();
        };

        this.$initSideBySideTabs = function() {
            if (!this.pdfSplitter) {
                this.pdfSplitter = new apf.splitter({
                    id : "splitterPanelPdf"
                });
                this.colPdf = new apf.vbox({
                    id   : "colPdf",
                    flex : 1
                });
                hboxMain.appendChild(this.pdfSplitter, colRight);
                hboxMain.appendChild(this.colPdf, colRight);
            }
            this.pdfSplitter.show();
            this.colPdf.show();

            this.hbox = this.colPdf.appendChild(new apf.hbox({flex : 1, padding : 5, splitters : true}));
            var tabPlaceholder = this.hbox.appendChild(
                new apf.bar({id:"tabPdfPlaceholder", flex:1, skin:"basic"})
            );

            var self = this;
            tabPlaceholder.addEventListener("resize", this.resizeTabCallback = function(e){
                // Copied from ext/editors/editors.js to put the tabs in the right place
                var ext = self.tabBar.$ext, ph;
                var pos = apf.getAbsolutePosition(ph = tabPlaceholder.$ext);
                ext.style.left = pos[0] + "px";
                ext.style.top  = pos[1] + "px";
                var d = apf.getDiff(ext);
                ext.style.width = (ph.offsetWidth + 2 + (apf.isGecko && colRight.visible ? 2 : 0) - d[0]) + "px";
                ext.style.height = (ph.offsetHeight - d[1]) + "px";
            });

            this.colPdf.addEventListener("resize", function(e) {
                self.$showPdf();
            });

            this.hideSidePanel();
        };

        this.$destroySideBySideTabs = function() {
            this.pdfSplitter.hide();
            this.colPdf.hide();
        
            this.hbox.removeNode();
            delete this.hbox;

            tabPlaceholder.removeEventListener("resize", this.resizeTabCallback);
            delete this.resizeTabCallback;
        };

        this.$initSinglePaneTabs = function() {
            // Make space on the right hand side of the editor tabs
            var editorTabBar = tabEditors.$ext.selectNodes("div[1]")[0];
            if (editorTabBar)
                editorTabBar.style["margin-right"] = "130px";

            // Even though we have two groups of tabs we want them to behave like
            // one, so when a tab in one is activated we deactivate the tab in the 
            // other.
            tabOutput.addEventListener("beforeswitch", this.tabOutputCallback = function() { 
                self.$deactivateEditorTabs();
            });
            tabEditors.addEventListener("beforeswitch", this.tabEditorsCallback = function() {
                self.$deactivateOutputTabs();
            });

            var self = this;
            tabPlaceholder.addEventListener("resize", this.resizeTabCallback = function(e){
                // Copied from ext/editors/editors.js to put the tabs in the right place
                var ext = self.tabBar.$ext, ph;
                var pos = apf.getAbsolutePosition(ph = tabPlaceholder.$ext);
                ext.style.left = pos[0] + "px";
                ext.style.top  = pos[1] + "px";
                var d = apf.getDiff(ext);
                ext.style.width = (ph.offsetWidth + 2 + (apf.isGecko && colRight.visible ? 2 : 0) - d[0]) + "px";
                ext.style.height = (ph.offsetHeight - d[1]) + "px";
            });
        };

        this.$destroySinglePaneTabs = function() {
            // Remove the space on the right hand side of the editor tabs
            var editorTabBar = tabEditors.$ext.selectNodes("div[1]")[0];
            if (editorTabBar)
                editorTabBar.style["margin-right"] = "0";

            tabOutput.removeEventListener("beforeswitch", this.tabOutputCallback);
            tabEditors.removeEventListener("beforeswitch", this.tabEditorsCallback);

            tabPlaceholder.removeEventListener("resize", this.resizeTabCallback);
            delete this.resizeTabCallback;
        },

        // Create the tabs to display the PDF and log if they don't exist yet
        this.initOutputTabs = function() {
            if (!tabOutput.getPage("pdfPage")) {
                this.pdfPage = tabOutput.add("PDF", "pdfPage");
            }
            
            if (!tabOutput.getPage("logPage")) {
                this.logPage = tabOutput.add("Log", "logPage");
            }
        };

        this.$deactivateEditorTabs = function() {
            if (tabEditors.getPages().length > 0)
                tabEditors.getPage().$deactivate();
        };
        
        this.$deactivateOutputTabs = function() {
            if (tabOutput.getPages().length > 0)
                tabOutput.getPage().$deactivate();
            this.$hidePdf();
        };
        
        this.showPdfTab = function() {
            tabOutput.set("pdfPage");
            if (this.$isTabbed()) {
                this.$deactivateEditorTabs();
            }
            tabOutput.getPage("pdfPage").$activate();
            this.$showPdf();
        }; 
        
        this.showLogTab = function() {
            tabOutput.set("logPage");
            if (this.$isTabbed()) {
                this.$deactivateEditorTabs();
            }
            tabOutput.getPage("logPage").$activate();
        };
        
        this.setPdfTabToPdf = function(url) {
            this.$removePdf();

            var page = tabOutput.getPage("pdfPage");
            while (page.childNodes.length > 0) {
                page.firstChild.removeNode();
            }
           
            this.$insertPdf(url);
            this.$hidePdf();
        };
        
        this.setPdfTabToNoPdf = function() {
            this.$removePdf();

            var page = tabOutput.getPage("pdfPage");
            while (page.childNodes.length > 0) {
                page.firstChild.removeNode();
            }
            
            page.appendChild(noPdf);
        };
        
        this.setLogTabToLog = function(content) {
            var page = tabOutput.getPage("logPage");
            
            // Get rid of existing content
            while (page.childNodes.length > 0) {
                page.firstChild.removeNode();
            }

            // Force some styling to let us scroll the log
            page.$ext.style["overflow"] = "scroll";

            // Do our best to extract the errors from the log
            var parsedLog = logParser.parse(content);

            // Update the Log tab to show the number of errors
            var totalErrors = parsedLog.errors.length + parsedLog.warnings.length
            if (totalErrors > 0) {
                page.setAttribute("caption", "Log (" + totalErrors + ")")
            } else {
                page.setAttribute("caption", "Log")
            }

            // Append nicely formatted summaries of the errors and warnings
            var self = this;
            function addLogEntry(entry, type) {
                var path;
                if (m = entry.file.match("[0-9a-f]{32}/(.*)$")) {
                    path = m[1];
                }

                var logEntry = new apf.logentry({
                    summary : self.$apfEscape(entry.message),
                    content : self.$apfEscape(entry.content),
                    path    : self.$apfEscape(path),
                    lineno  : entry.line,
                    type    : type
                }) 
                page.appendChild(logEntry);
                if (path && entry.line) {
                    logEntry.setProperty("ongoto", function() {
                        self.jumpToFileAndLineNumber(path, entry.line);
                    });
                }
            }

            for (i = 0; i < parsedLog.errors.length; i++) {
                var error = parsedLog.errors[i];
                addLogEntry(error, "error");
            }
            
            for (i = 0; i < parsedLog.warnings.length; i++) {
                var warning = parsedLog.warnings[i];
                addLogEntry(warning, "warning");
            }

            // Append the raw log
            var preElement = this.logContent.selectNodes("pre")[0];
            if (preElement)
                preElement.$ext.innerHTML = content;
            page.appendChild(this.logContent);
        };

        this.popOutSidePanel = function() {
            if (this.$isSideBySide()) {
                this.colPdf.show();
                this.pdfSplitter.show();
                this.pdfSplitter.$setSiblings();

                if (colPdf.getWidth() < 10) {
                    // Set the Pdf view to half the editor area.
                    // For some reason we need to do this twice for it to work?
                    this.pdfSplitter.update(
                        splitterPanelLeft.getLeft() + 
                        (colMiddle.getWidth() + this.colPdf.getWidth())/2
                    );
                    this.pdfSplitter.update(
                        splitterPanelLeft.getLeft() + 
                        (colMiddle.getWidth() + this.colPdf.getWidth())/2
                    );
                }
            }
        };

        this.hideSidePanel = function() {
            if (this.$isSideBySide()) {
                this.colPdf.hide();
                this.pdfSplitter.hide();
            }
        };

        this.$insertPdf = function(url) {
            this.pdfElement = new apf.pdf({
                skinset : "latex",
                source : url
            });

            apf.document.body.appendChild(this.pdfElement);
        };

        this.$removePdf = function() {
            if (this.pdfElement) {
                apf.document.body.removeChild(this.pdfElement);
                delete this.pdfElement;
            }
        };

        this.$hidePdf = function() {
            if (this.pdfElement) {
                var pdfExt = this.pdfElement.$ext

                // Hide it offscreen because setting "display: none" causes the
                // pdf to reset the scroll to the top. This is true in at least 
                // Chrome.
                pdfExt.style.position = "absolute";
                pdfExt.style.top      = "-100px";
                pdfExt.style.height   = "5px";
            }
        };

        this.$showPdf = function() {
            if (this.pdfElement) {
                var pageExt = tabOutput.getPage("pdfPage").$ext;
                var pos = apf.getAbsolutePosition(pageExt);
                var pdfExt = this.pdfElement.$ext;
                pdfExt.style["z-index"] = "100"; 
                pdfExt.style.position   = "absolute";
                pdfExt.style.left       = pos[0] + "px";
                pdfExt.style.top        = pos[1] + "px";
                pdfExt.style.width      = pageExt.offsetWidth + "px";
                pdfExt.style.height     = pageExt.offsetHeight + "px";
            }
        };

        // APF interprets content between { and } as bindings to data and
        // tries to replace it. These appear naturally in many strings to do
        // with LaTeX so we must escape every string we pass to APF.
        this.$apfEscape = function(str) {
            if (typeof str === "string")
                return str.replace("{", "\\{").replace("}", "\\}");
            else
                return str;
        };
    }).call(View.prototype);

    return View;
})
