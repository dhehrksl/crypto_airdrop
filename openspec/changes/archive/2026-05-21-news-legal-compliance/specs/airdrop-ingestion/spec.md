## ADDED Requirements

### Requirement: 휴리스틱 분류 항목은 출처 원문 본문을 복제하지 않아야 한다

AI 검증을 거치지 않고 키워드 휴리스틱만으로 `News` 컬렉션에 저장되는 항목은, 출처 RSS의 본문·발췌(`contentSnippet`/`content`)를 변형 없이 `description`에 저장해서는 안 된다(MUST NOT). 휴리스틱 저장 항목의 `description`은 시스템이 정의한 정형 안내 문구(예: 원문 링크에서 상세 내용을 확인하라는 안내)여야 한다(MUST). 출처가 제공한 가공되지 않은 본문 텍스트는 헤드라인(`title`)과 원문 링크(`official_link`)를 제외하고 앱 화면에 노출되어서는 안 된다.

가공된 한국어 요약 `description`은 AI 분류기를 거쳐 `LEGAL SAFETY RULES`(원문 재출판 금지, 한 문장 중립 문맥)에 따라 생성된 항목에 한해 저장될 수 있다(SHALL).

#### Scenario: 휴리스틱 경로로 저장되는 일반 뉴스 항목

- **WHEN** 스크래퍼가 휴리스틱 점수가 `AI_THRESHOLD` 미만인 RSS 항목을 `News`로 저장한다
- **THEN** 저장되는 `description`은 출처 원문 발췌가 아니라 시스템 정의 정형 안내 문구이며, `title`은 출처 헤드라인, `official_link`는 원문 링크다

#### Scenario: AI 배치 실패로 휴리스틱 fallback이 동작

- **WHEN** AI 배치 호출이 실패하거나 특정 항목의 결과가 누락되어 해당 항목이 휴리스틱 경로로 fallback 저장된다
- **THEN** 그 항목의 `description` 또한 출처 원문 발췌를 포함하지 않고 정형 안내 문구로 저장된다

#### Scenario: AI 검증을 통과한 뉴스 항목

- **WHEN** AI 분류기가 `is_airdrop=false`로 판정하여 항목을 `News`로 저장한다
- **THEN** `description`은 AI가 생성한 한 문장짜리 한국어 중립 요약이며, 출처 원문을 그대로 옮긴 것이 아니다
