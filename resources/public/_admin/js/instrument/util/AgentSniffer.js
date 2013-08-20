var instrument.util.AgentSniffer = (function(){
  
  var isIE = function(){
    
  };
  
  var isChrome = function(){
    
  };
  
  var isMozilla = function(){
    
  };
  
  var isAndroid = function(){
    
  };
  
  var isIOS = function(){
    if (navigator.userAgent.match(/like Mac OS X/i)) {
        return true;
    }
    
    return false;
  };
  
  return {
    isIOS: isIOS
  };
  
})();