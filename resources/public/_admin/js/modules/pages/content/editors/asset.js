(function (global) {
    global.caribou = global.caribou || {};
    var editors = global.caribou.editors;
    if (!editors) {
        throw "editors/base.js and editors/fields.js have not been included";
    }
    /* for assets embedded in forms */
    function AssetFieldEditor( options ) { editors.PartFieldEditor.call( this, options ); }
    $.extend( AssetFieldEditor.prototype, editors.PartFieldEditor.prototype, {
        syncToDOM: function() {
            var asset = this.value.value;
            if ( asset ) {
                var img = $(".image-" + this.field.slug);
                if ( asset['content-type'].indexOf("image") >= 0 ) {
                    if (!img.length) {
                        img = $("<img class='thumbnail image-" + this.field.slug + "' style='max-width:150px' />");
                        $("#" + this.model.slug + "-" + this.field.slug).prepend(img);
                    }
                    img.attr({ src: asset.path }).show();
                    console.log("using " + asset.path + " for image");
                } else {
                    $(".image-" + this.field.slug).attr({ src: "/img/file-icon.png" }).show();
                    $(".image-" + this.field.slug).after(asset.path);
                }
            } else {
                $(".image-" + this.field.slug).hide();
            }
        },
        syncFromDOM: function() {},
        attach: function() {
            var self = this;
            $("#" + self.model.slug + "-" + self.field.slug).find("a").click( function(e) {
                e.preventDefault();
                console.log(self, "Upload/choose an asset");
                return self.uploadOrChoose();
            });
            if (this.value.value) {
                var removeLink = $("<a href='#' class='btn btn-primary'>Remove</a>").on("click", function(e) {
                    e.preventDefault();
                    self.setBlank();
                    $(this).remove();
                });
                $("#" + self.model.slug + "-" + self.field.slug).find("a").after(removeLink);
            }
        },
        setBlank: function() {
            this.value = { value: null, id: null };
            this.syncToDOM();
        },
        uploadOrChoose: function() {
            var self = this;

            var editor = new editors.AssetEditor({
                from: self,
                field: self.field,
                model: self.api().model("asset"),
                submit: function( value, next ) {
                    self.value.value = value;
                    self.value.id = (value? value.id : null);
                    self.callbackWithValue("sync", self.value, next);
                }
            });

            editor.load( function( data, error, jqxhr ) {
                editor.template = data.template;
                editor.value = data.state || editor.value;
                self.stack().push( editor );
            });

            return false;
        }
    });
    /* this is for the asset picker */
    function AssetEditor( options ) {
        editors.Editor.call( this, options );
        this.field = options.field;
        this._assetsById = {};
    }
    $.extend( AssetEditor.prototype, editors.Editor.prototype, {
        description: function() { return this.field.slug },
        attach: function() {
            var self = this;
            $("#upload-asset").ajaxfileupload({
                action: self.api().routeFor("upload-asset"),
                valid_extensions: null,
                onComplete: function(response) {
                    try {
                        self.value = response.state;
                        if ( self.value['content-type'].indexOf("image") === 0 ) {
                            $("#current-image").show().attr("src", self.value.path);
                        } else {
                            $("#current-image").hide().after("<b>" + self.value.path + "</b>" );
                        }
                        self.load(function( data, error, jqxhr ) {
                            self.refreshAssets();
                        });
                    } catch (e) {
                        global.caribou.status.addErrorMessage("Unable to upload that asset.  Is it too big?").render();
                    }
                }
            });
            $("#upload-button").click( function(e) {
                e.preventDefault();
                self.upload(e);
            });
            $("#delete-button").click( function(e) {
                e.preventDefault();
                global.caribou.models.showDeleteDialog(
                    {},
                    function()
                    {
                        var asset_id = $("select[name=images]").val();
                        console.log("delete clicked " + asset_id);
                        $.ajax({
                            url: global.caribou.api.routeFor( "delete-all" ),
                            type: "POST",
                            //dataType: "json",
                            contentType: "application/json; charset=utf-8",
                            data: JSON.stringify({data: [
                                { model: "asset",
                                  id: asset_id
                                }
                            ]}),
                            success: function(){},
                            failure: function(){}
                        });
                        self.load(function( data, error, jqxhr ) {
                            self.refreshAssets();
                        });
                    });
            });
            $("#asset-search-button").click( function(e) {
                e.preventDefault();
                self.refreshAssets();
            });
            self.refreshAssets();
        },
        load: function( success ) {
            var self = this;
            var route = self.api().routeFor( "editor-content", {
                id: self.get("id", ""),
                model: "asset",
                template: "_asset.html"
            });
            $.ajax({ url: route, success: success });
        },
        loadAssets: function(assets) {
            var self = this;
            self._assetsById = self._assetsById || {};
            _( assets ).each( function(a) { self._assetsById[a.id] = a } );
        },
        refreshAssets: function(page) {
            var self = this;
            $.ajax({
                url: self.api().routeFor( "editor-content",
                                          { model: "asset", template: "_existing_assets.html", page: (page || "0"), size: 50 }
                                        ),
                type: "GET",
                success: function( data, error, jqxhr ) {
                    self.loadAssets(data.state);
                    $("#assets").html( data.template );
                    $("#assets").find("select[name=images]").imagepicker({ show_label: true });
                    $("#assets a").click( function(e) {
                        e.preventDefault();
                        self.refreshAssets($(this).data().page);
                    });
                }
            });
        },
        syncFromDOM: function() {
            console.log("AssetEditor syncing from DOM");
            var assetId = $("select[name=images]").val();
            if ( assetId ) {
                this.value = asset = this._assetsById[ assetId ];
            }
            console.log( this.value );
        }
    });

    editors.AssetFieldEditor = AssetFieldEditor;
    editors.AssetEditor = AssetEditor;
})(window);
