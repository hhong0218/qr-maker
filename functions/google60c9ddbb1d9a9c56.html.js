/** Google Search Console 소유 확인 — Pages의 .html 308 리다이렉트 우회용 */
export async function onRequest() {
  return new Response('google-site-verification: google60c9ddbb1d9a9c56.html', {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
