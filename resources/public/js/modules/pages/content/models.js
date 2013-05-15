( function(global) {
  function models() {
    var validateName = function(name) {
      console.log('Checking name ' + name);
      // if name is invalid, disable form submission
      // tbd.
    };

    // enable sortable elements
    var enableSorting = function( opts ) {
      opts = opts || {};
      var selector = opts.selector || ".sortable";
      var rowNumber = $(".sortable tr").length;

      // Return a helper with preserved width of cells
      if (rowNumber > 1) {
        $(selector).sortable({
          start: function(e, ui){
            ui.placeholder.html('<td colspan="10">&nbsp;</td>');
          },
          placeholder: "ui-sortable-placeholder",
          forcePlaceholderSize: true,
          helper: function(e, ui) {
            ui.children().each(function() {
              $(this).width($(this).width());
            });
            return ui;
          },
          items: "tr:not(.ui-state-disabled)",
          cancel: ".ui-state-disabled",
          update: function(e, ui) {
            updateOrdering(function() {
              console.log("Updated ordering automatically");
            });
            //$('.changeOrderMessage').show();
            // TODO:kd - disable other controls?
          },
          stop: function(e, ui) {
            ui.item.addClass('ui-sortable-highlight');
            setTimeout(function() {
              ui.item.removeClass('ui-sortable-highlight');
            }, 500);
          }
        });
      } else {
        $(selector).sortable({ disabled: true });
        $(selector).removeClass('sortable');
      }
    };

    var _post = function( action, data, success, failure ) {
      success = success || function( data ) {
        location.reload(); // what's the kosher way to do this again?
      };
      failure = failure || function(e) { console.error(e) };

      // submit items
      $.ajax({
        url: global.caribou.api.routeFor( action ),
        type: "POST",
        //dataType: "json",
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify({ data: data }),
        success: success,
        failure: failure
      });
    }

    var updateOrdering = function( success ) {
      var selector = $( ".sortable" ).sortable( "option", "items" );
      var parentData = $(".sortable").data("position");
      var items = [];
      var payload = { model: parentData.model,
                      association: parentData.association,
                      id: parentData.umbrella
                    };

      $(".sortable").find(selector).each( function( index, item ) {
        var data = $(item).data("position") || {};
        console.log( "Initial is " + data.position + " and index is " + index );
        if ( data.position !== ( index + parentData.offset + 1 ) ) {
          // we add one because position is one-based, not zero-based.
          items.push( { id: data.id, position: index + parentData.offset + 1 } );
        }
      });
      payload.items = items;
      console.log(payload);
      // submit items
      _post( "reorder-all", payload, success );
    }

    var showDeleteDialog = function( el, callback ) {
      var data = [ { model: $(el).data().model || "field", id: $(el).data().id + '' } ];
      $('#delete').find('#delete-submit').click( function( e ) {
        e.preventDefault();
        _post( "delete-all", data, function() {
          $('#delete').modal('hide');
          if (callback) {
            callback( data );
          } else {
            location.reload();
          }
        });
        return false;
      });

      $('#delete').modal('show');
      return false;
    }

    var formatAddress = function( data ) {
      // cheesy
      var bits = [];
      _([ "address", "address-two", "city", "state", "postal-code", "country" ]).each(function(key) {
        if (data[key]) {
          bits.push( data[key] );
        }
      });
      return bits.join(",\n");
    };

    var mapImageURL = function( data, width, height ) {
      var template = "http://maps.googleapis.com/maps/api/staticmap?center={{location}}&zoom=15&size={{width}}x{{height}}&maptype=roadmap&sensor=false";
      var builder = _.template( template );
      return builder({
        "location": formatAddress(data),
        "width": (width || 300),
        "height": (height || 300)
      });
    };

    var showAddFieldDialog = function( el ) {
      var data = $( el ).data();
      $("#new-field").modal();
      $("#new-field select[name='field-type']").change(function( e ) {
        $("#new-field #slug-controls").hide();
        $("#new-field #association-controls").hide();
        $("#new-field #timestamp-controls").hide();
        $("#new-field #association-controls select").prop("disabled", true);
        $("#new-field #searchable").prop("disabled", false);
        $("#new-field #slug-controls select").prop("disabled", true);
        var v = $( this ).val();
        switch (v) {
          case "collection":
          case "part":
          case "link":
            $("#new-field #association-controls").show();
            $("#new-field #association-controls select").prop("disabled", false);
            if ( v === "part" ) {
              $("#new-field #reciprocal-name").val( owl.pluralize( data.model ) );
            } else {
              $("#new-field #reciprocal-name").val( data.model );
            }
            break;
          case "slug":
          case "urlslug":
            $("#new-field #slug-controls select").prop("disabled", false);
            $("#new-field #slug-controls").show();
            break;
          case "password":
            $("#new-field #searchable").prop("checked", false);
            $("#new-field #searchable").prop("disabled", true);
            break;
          case "timestamp":
            $("#new-field #timestamp-controls").show();
            break;
          default:
            break;
        }
      });
    }

    var enableDeleteLinks = function( opts ) {
      $(".delete-link").on("click", function(e) {
        e.preventDefault();
        showDeleteDialog( this );
      });
    };

    // enable any sorting on the page initially
    enableSorting();
    enableDeleteLinks();

    return {
      validateName: validateName,
      updateOrdering: updateOrdering,
      showDeleteDialog: showDeleteDialog,
      showAddFieldDialog: showAddFieldDialog,
      enableDeleteLinks: enableDeleteLinks,
      post: _post,
      enableSorting: enableSorting,
      formatAddress: formatAddress,
      mapImageURL: mapImageURL
    };
  }

  global.caribou = global.caribou || {};
  global.caribou.models = models();

})( window );
