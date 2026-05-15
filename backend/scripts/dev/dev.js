const { spawn } = require('child_process');
const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');

// 1. 기존 서버 실행
const server = spawn('node', ['server.js'], { stdio: 'inherit' });

// 2. 2초 뒤 서버가 켜지면 터널링 시작
setTimeout(async () => {
  try {
    const tunnel = await localtunnel({ port: 3000 });
    
    console.log('\n=========================================');
    console.log('🌐 백엔드 터널링 성공!');
    console.log(`터널 URL: ${tunnel.url}`);
    console.log('=========================================\n');
    
    // 3. 프론트엔드 파일(HomeScreen.js, DetailScreen.js)의 API_URL을 자동 업데이트
    const homePath = path.join(__dirname, '../frontend/src/screens/HomeScreen.js');
    const detailPath = path.join(__dirname, '../frontend/src/screens/DetailScreen.js');
    
    const updateUrl = (filePath) => {
      try {
        let content = fs.readFileSync(filePath, 'utf8');
        // 정규식으로 기존 API_URL 대체
        content = content.replace(
          /const API_URL = 'http.*';/, 
          `const API_URL = '${tunnel.url}/api/airdrops';`
        );
        fs.writeFileSync(filePath, content);
      } catch (e) {
        console.error(`파일 업데이트 실패 (${filePath}):`, e.message);
      }
    };
    
    updateUrl(homePath);
    updateUrl(detailPath);
    console.log('✅ 프론트엔드 API_URL 주소가 자동으로 업데이트 되었습니다. (앱 자동 새로고침 됨)');
    
    tunnel.on('close', () => {
      console.log('터널이 닫혔습니다.');
    });
    
  } catch (err) {
    console.error('터널 생성 오류:', err);
  }
}, 2000);

// 프로세스 종료 시 자식 프로세스 정리
process.on('SIGINT', () => {
  server.kill('SIGINT');
  process.exit();
});
