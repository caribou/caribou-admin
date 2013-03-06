(function (global) {
    function CaribouAPI( api ) {
      var self = {
        routeFor: function( action, params ) {
            params = params || {};
            params['action'] = action;
            // TODO:kd - filter for nulls
            if ( !params['id'] ) {
              delete params['id'];
            }
            return api + "?" + $.param( params );
        },
        initWithModel: function( model ) {
          self._model = {};
          _( model ).each( function(m) {
            self._model[ m.slug ] = m;
            self._model[ m.id ] = m;
          });
        },
        model: function( slug ) {
          return self._model[ slug ];
        },
        models: function() {
          return self._model;
        },
        bestTitle: function( m, slug ) {
          var model = self.model( slug );
          if ( !model ) { console.error( "No such model " + slug ); return }
          var guess = "";
          _( model.fields ).each( function(f) {
            guess = guess || m[f.slug];
          });
          return guess;
        },
        post: function( data, success, failure ) {
          success = success || function( data ) {
            location.reload(); // what's the kosher way to do this again?
          };
          failure = failure || function(e) { console.error(e) };

          // submit items
          $.ajax({
            url: self.routeFor( "update-all" ),
            type: "POST",
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify({ data: data }),
            success: success,
            failure: failure
          });
        }
      };

      // fetch a fresh model synchronously. This is a bad idea; TODO:kd - solve this properly.
      $.ajax({
        type: "POST",
        async: false,
        url: self.routeFor( "find-all", { model: "model", include: "fields" } ),
        success: function( data ) {
          self.initWithModel( data );
        }
      });
      return self;
    }


    global.caribou = global.caribou || {};
    global.caribou.api = CaribouAPI( $('body').data().api );
})(window);
