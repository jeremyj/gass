function isMobile(userAgent) {
  const mobilePatterns = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
    /Opera Mini/i,
    /IEMobile/i
  ];
  return mobilePatterns.some(pattern => pattern.test(userAgent));
}

function shouldUseMobileView(req) {
  // Check cookie first for testing, then user-agent
  if (req.cookies.force_mobile === 'true') return true;
  return isMobile(req.headers['user-agent'] || '');
}

module.exports = { isMobile, shouldUseMobileView };
