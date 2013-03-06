// for now stash useful stuff like this here
(function($) {
  $.fn.sortOptionList = function() {
    var val = $( this ).val();
    var options = $( this ).find("option");
    options.sort(function(a, b) {
      if (a.text > b.text) return 1;
      else if (a.text < b.text) return -1;
      else return 0
    });
    $( this ).empty().append( options ).val( val );
  };
})(jQuery);

