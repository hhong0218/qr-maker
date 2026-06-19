# QR코드 만들기

소상공인·마케터를 위한 무료 한국어 QR코드 생성기입니다. 회원가입 없이 브라우저에서 바로 QR코드를 만들고 PNG/SVG로 저장할 수 있습니다.

라이브: https://qr.matchiq.co.kr

## 기능

- **5가지 입력 타입**: URL, 텍스트, 연락처(vCard), Wi-Fi, SNS 링크(카카오/인스타그램/유튜브/네이버)
- **용도별 프리셋**: 식당 메뉴판, 카페 Wi-Fi, 카카오 채널, 제품 라벨, 명함, 스마트스토어
- **커스터마이징**: 크기(100~1000px), 전경/배경 색상, 투명 배경, 점 모양(사각/둥근/원형), 모서리 패턴, 여백
- **로고 삽입**: PNG/JPG/SVG 업로드, 크기 조절, 흰색 패딩/원형 클리핑. 업로드 시 오류 수정 레벨 자동 H 전환
- **내보내기**: PNG 저장, 고화질 x4 PNG, SVG(로고 포함), 클립보드 복사
- **히스토리**: 최근 생성 QR 10개를 localStorage에 저장, 클릭 한 번으로 설정 복원
- 모든 처리는 브라우저에서만 이루어지며 서버로 데이터를 전송하지 않습니다

## 기술 스택

- 순수 HTML / CSS / JavaScript — 빌드 도구·프레임워크 없음
- QR 매트릭스 생성: [qrcodejs](https://github.com/davidshimjs/qrcodejs) (cdnjs CDN)
- 렌더링: Canvas 2D API (PNG), 직접 생성한 SVG 마크업 (SVG)

## 배포

`main` 브랜치에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 Cloudflare Pages(`qr-maker` 프로젝트)로 자동 배포합니다.

```
push to main → GitHub Actions → wrangler pages deploy → https://qr.matchiq.co.kr
```

## 파일 구성

```
index.html      메인 앱 (생성기 + FAQ + 구조화 데이터)
about.html      사이트 소개
privacy.html    개인정보처리방침
terms.html      이용약관
guides/         한국어 활용 가이드 3편 (와이파이 QR / QR 마케팅 / 인식 문제 해결)
css/style.css   전체 스타일
js/app.js       앱 로직 (생성/커스터마이징/내보내기/히스토리)
favicon.svg     파비콘
og-image.png    소셜 공유 이미지 (1200×630)
sitemap.xml     사이트맵
robots.txt      크롤러 정책
```
