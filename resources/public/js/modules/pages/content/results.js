$(function() {
  $("#command-menu").off("change").on("change", function(e) {
    var command = $(this).val();
    switch (command) {
      case "edit":
        
        break;
      default:
    };
  }).show();
});
