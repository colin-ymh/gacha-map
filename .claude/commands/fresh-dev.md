# fresh-dev

모든 캐시와 의존성을 완전히 초기화하고 개발 서버를 시작합니다.

다음 순서로 실행하세요:

1. `.next` 폴더 삭제: `rm -rf .next`
2. `node_modules` 폴더 삭제: `rm -rf node_modules`
3. npm 캐시 정리: `npm cache clean --force`
4. 의존성 재설치: `npm install`
5. 개발 서버 시작: `npm run dev`
