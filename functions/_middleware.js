// *.pages.dev 기본 도메인으로 들어온 요청을 커스텀 도메인(qr.matchiq.co.kr)으로 301 영구 이전.
// 커스텀 도메인 요청은 그대로 통과시킨다. (중복 색인/트래픽 분산 방지)
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname.endsWith('.pages.dev')) {
    url.protocol = 'https:';
    url.hostname = 'qr.matchiq.co.kr';
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
