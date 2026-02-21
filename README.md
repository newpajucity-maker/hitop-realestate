# 하이탑부동산 매물관리 시스템
**최종 안정화 버전 v2.0** | 2025-02

## 변경 파일 목록
| 파일 | 변경 내용 |
|------|-----------|
| `assets/js/storage.js` | schemaVersion 도입 + 자동 migrate 함수 |
| `assets/js/data.js` | getListings() null-safe 필터 추가 |
| `assets/js/register.js` | descChecks 수집/로드, toggleDescArea, collectDescChecks 추가 |
| `assets/js/list.js` | bizcenter 컬럼 추가, 체크박스 이벤트 버그 수정 |
| `assets/js/detail.js` | renderInfoPrint() 전면 재설계 (A4 부동산 매물 설명서) |
| `assets/css/info-print.css` | A4 인쇄 전문 양식 완전 재설계 |
| `assets/css/register.css` | 매물설명 체크 섹션 스타일 추가 |
| `assets/css/app.css` | 공통 input/button/field 레이아웃 통일 패치 |
| `assets/css/list.css` | 테이블 정렬/간격 안정화 패치 |
| `register.html` | 매물 설명 체크박스 섹션 (4개 항목) 추가 |

## 주요 개선 사항
1. **A4 매물 설명서** - 헤더(상호+전화+출력일) → 핵심요약박스 → 상세정보표 → 매물설명 → 푸터
2. **매물 설명 체크 구조** - 입지/수요/강점/유의사항 4개 섹션, 체크한 항목만 저장+출력
3. **localStorage 마이그레이션** - schemaVersion v2, floor→floorGroup 자동 변환
4. **bizcenter 리스트 컬럼** 추가 (기존 누락)
5. **수정 모드 연결** - detail.html에서 "수정" 버튼 → register.html?id= 자동 이동
6. **null/undefined 안전 처리** - 모든 필드 기본값 보장

## 발견된 버그 및 수정 내역
| # | 버그 | 수정 |
|---|------|------|
| 1 | bizcenter 유형 선택 시 리스트 컬럼 미출력 | list.js에 bizcenter 컬럼 배열 추가 |
| 2 | 수정 버튼 alert만 표시 | register.html?id= 로 이동 연결 |
| 3 | 구버전 floor 필드 데이터 floorGroup 필터 미작동 | migrate 시 자동 변환 |
| 4 | 인쇄 시 매물 설명 섹션 없음 | A4 전문 양식으로 완전 재설계 |
| 5 | memoEntries 없는 구데이터 detail 오류 | 호환 fallback 처리 |

## 테스트 체크리스트
1. `index.html` 열기 → 유형 필터 전환 → 각 유형별 컬럼 확인
2. "매물등록" → 상가 선택 → 건물 선택 → 각 필드 입력 → 메모 추가 → 설명 체크 → 저장
3. 목록에서 매물 클릭 → 상세 확인 → "수정" 클릭 → 기존값 복원 확인
4. 상세 → "매물설명 출력" → 인쇄 미리보기 → A4 양식 확인
5. 목록 → 체크박스 선택 → "선택 출력" / "단건 출력" 동작 확인
6. 개발자도구 Console 열기 → 에러 0개 확인
