# IP Stargaze - 분산 모니터링 기능 명세서

> 원격 서버에 경량 에이전트를 배포하고, 중앙 IP Stargaze가 폴링하여 다중 서버 트래픽을 통합 시각화하는 분산 모니터링 아키텍처

---

## 1. 요청 분석

### 1.1 핵심 문제 정의

현재 IP Stargaze는 **단일 로컬 장비**의 트래픽만 모니터링한다. 운영 환경에서는 여러 서버(웹 서버, DB 서버, API 서버 등)의 트래픽을 **하나의 대시보드**에서 통합 확인할 필요가 있다. 각 원격 서버에 경량 수집 프로세스(에이전트)를 설치하고, 중앙 IP Stargaze가 이를 주기적으로 폴링하여 기존 Star 그래프에 통합 표시하는 구조를 추가한다.

### 1.2 명시적 요구사항

| # | 요구사항 | 출처 |
|---|---------|------|
| E-01 | 감시 대상 원격 서버에서 동작하는 서버 프로세스(에이전트) 필요 | 사용자 명시 |
| E-02 | 중앙 IP Stargaze가 에이전트를 폴링하는 클라이언트 역할 | 사용자 명시 |
| E-03 | 폴링된 데이터를 기존 시각화 파이프라인에 통합 | 사용자 명시 |
| E-04 | 타임스탬프 처리 필요 (원격 서버의 캡처 시점 기준) | 사용자 명시 |
| E-05 | 기존 로컬 모니터링은 그대로 유지 (additive 구조) | 사용자 암시 |

### 1.3 암묵적 요구사항 (도출)

| # | 요구사항 | 근거 |
|---|---------|------|
| I-01 | 에이전트는 최대한 경량이어야 함 | 모니터링 대상 서버에 부하를 주면 안 됨 |
| I-02 | 에이전트 장애 시 중앙 시스템이 정상 동작해야 함 | 분산 시스템 기본 원칙 |
| I-03 | 여러 에이전트의 데이터를 구분할 수 있어야 함 | 어느 서버에서 온 트래픽인지 식별 필요 |
| I-04 | 에이전트 추가/제거를 런타임에 할 수 있어야 함 | 운영 편의성 |
| I-05 | 에이전트-콜렉터 간 인증 메커니즘 필요 | 원격 통신 보안 |
| I-06 | 시계 차이(clock skew) 처리 | 서버 간 시간 동기화 불완전 가능 |

### 1.4 전제 조건

| # | 전제 | 근거 |
|---|------|------|
| A-01 | 에이전트와 콜렉터는 같은 네트워크 또는 VPN 내에 있다 | 보안 및 지연 시간 |
| A-02 | 에이전트 수는 최대 20대 수준 (소~중규모) | 개인/소규모 팀 도구 성격 |
| A-03 | 에이전트는 동일한 Node.js 기반으로 구현한다 | 기존 코드베이스 재사용 |
| A-04 | 에이전트도 tcpdump 또는 시뮬레이션 모드로 패킷 캡처 | 기존 captureManager 재사용 |
| A-05 | 에이전트의 OS는 Linux/macOS를 가정 (tcpdump 가용) | 기존 pcapCapture 요구사항 동일 |

---

## 2. 범위 정의

### 2.1 IN Scope (포함)

- 원격 에이전트 서버 프로세스 (`ip-stargaze-agent`)
- 중앙 콜렉터 모듈 (`RemoteCollector`)
- 에이전트 등록/관리 설정 (config 파일 기반 + UI)
- Aggregator 통합 (로컬 + 원격 이벤트 병합)
- 타임스탬프 처리 및 clock skew 보정
- UI에서 에이전트 상태 표시 및 소스 구분
- 에이전트-콜렉터 간 API 키 기반 인증
- 에이전트 헬스체크 및 장애 감지

### 2.2 OUT of Scope (제외)

- 에이전트 자동 배포/설치 (ansible, docker 등)
- 에이전트 간 직접 통신 (hub-spoke 구조만)
- TLS/mTLS 인증 (첫 버전에서는 HTTP + API 키, 추후 HTTPS 확장)
- 에이전트별 독립 대시보드 (통합 뷰만 제공)
- 히스토리 저장 / 리플레이
- 에이전트 원격 제어 (설정 변경, 재시작 등)

### 2.3 단계별 배포 계획

| 단계 | 범위 | 목표 |
|------|------|------|
| Phase 4A | 에이전트 서버 프로세스 + REST API | 원격 수집 인프라 구축 |
| Phase 4B | 콜렉터 모듈 + Aggregator 통합 | 통합 데이터 파이프라인 |
| Phase 4C | UI 변경 + 에이전트 관리 + 상태 표시 | 사용자 대면 기능 완성 |

---

## 3. 아키텍처 개요

### 3.1 현재 구조 (단일 서버)

```
[Browser] <--WebSocket--> [Fastify Server]
                               |
                        [CaptureManager]
                          |          |
                    [Simulator]  [PcapCapture]
                               |
                         [Aggregator] --> snapshot --> [WsHandler] --> broadcast
```

### 3.2 확장 구조 (분산 모니터링)

```
[Remote Server A]                    [Remote Server B]
  [ip-stargaze-agent]                  [ip-stargaze-agent]
  - CaptureManager (pcap/sim)          - CaptureManager (pcap/sim)
  - EventBuffer (ring buffer)          - EventBuffer (ring buffer)
  - Fastify REST API (:15119)          - Fastify REST API (:15119)
        |                                     |
        |  HTTP GET /api/events (polling)      |
        +------------------+------------------+
                           |
                   [Central IP Stargaze Server (:15118)]
                           |
                    [RemoteCollector]  <-- 주기적 폴링
                           |
                    [Aggregator]  <-- 로컬 packet + 원격 events 병합
                           |
                    [WsHandler] --> snapshot --> [Browser]
```

### 3.3 역할 정의

| 컴포넌트 | 역할 | 위치 |
|----------|------|------|
| **ip-stargaze-agent** | 원격 서버에서 패킷 캡처 + REST API로 이벤트 노출 | 감시 대상 서버 |
| **RemoteCollector** | 등록된 에이전트를 주기적으로 폴링, 이벤트를 Aggregator에 주입 | 중앙 서버 |
| **Aggregator** (기존) | 로컬 + 원격 이벤트를 통합 집계 | 중앙 서버 |
| **WsHandler** (기존) | 통합 스냅샷을 브라우저에 브로드캐스트 | 중앙 서버 |

---

## 4. 기능별 상세 명세

---

### 4.1 기능: 원격 에이전트 서버 프로세스 (F-030)

#### 개요
- **목적**: 감시 대상 원격 서버에서 로컬 트래픽을 캡처하고, REST API를 통해 중앙 콜렉터에 데이터를 제공하는 경량 프로세스
- **사용자**: 서버 관리자 (설치 및 실행), 중앙 콜렉터 (API 소비)
- **트리거**: 프로세스 시작 시 자동으로 캡처를 시작하고 API를 대기

#### 상세 요구사항

- **FR-101**: 에이전트는 독립 실행 가능한 Node.js 프로세스로, 기존 `CaptureManager` + `ipClassifier`를 재사용한다
- **FR-102**: 캡처된 패킷 이벤트를 메모리 내 **Ring Buffer**에 저장한다
  - Ring Buffer 최대 크기: 설정 가능 (기본 100,000 이벤트)
  - 버퍼가 가득 차면 가장 오래된 이벤트부터 덮어쓴다
  - 각 이벤트에는 monotonic sequence number를 부여한다
- **FR-103**: Fastify 기반 REST API를 제공한다 (기본 포트: 15119)
- **FR-104**: 에이전트 고유 식별자(`agentId`)를 설정한다
  - 설정 파일 또는 환경 변수로 지정
  - 미지정 시 hostname을 기본값으로 사용
- **FR-105**: API 요청에 대해 API 키 기반 인증을 적용한다
  - `Authorization: Bearer <api-key>` 헤더 검증
  - 키 불일치 시 `401 Unauthorized` 응답
- **FR-106**: 에이전트 상태를 나타내는 헬스체크 엔드포인트를 제공한다
- **FR-107**: 에이전트는 pcap(live) 또는 simulation 모드를 지원한다

#### API 엔드포인트 정의

##### `GET /api/health`

헬스체크. 인증 불필요 (또는 선택).

**응답 (200 OK)**:
```json
{
  "status": "ok",
  "agentId": "web-server-01",
  "uptime": 3600,
  "mode": "live",
  "interface": "eth0",
  "bufferSize": 45230,
  "bufferCapacity": 100000,
  "captureActive": true,
  "version": "0.1.0",
  "timestamp": 1739635200000
}
```

##### `GET /api/events?since={sequenceNumber}&limit={count}`

폴링 엔드포인트. 마지막으로 받은 sequence 이후의 이벤트를 가져온다.

**요청 파라미터**:

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `since` | number | 아니오 | 이 sequence number 이후의 이벤트만 반환. 생략 시 버퍼 내 모든 이벤트 |
| `limit` | number | 아니오 | 최대 반환 이벤트 수 (기본: 10000, 최대: 50000) |

**요청 헤더**:
```
Authorization: Bearer <api-key>
```

**응답 (200 OK)**:
```json
{
  "agentId": "web-server-01",
  "sequenceStart": 45001,
  "sequenceEnd": 45230,
  "events": [
    {
      "seq": 45001,
      "sourceIp": "203.0.113.45",
      "destPort": 443,
      "protocol": "TCP",
      "timestamp": 1739635199500,
      "bytes": 1420
    },
    {
      "seq": 45002,
      "sourceIp": "8.8.8.8",
      "destPort": 53,
      "protocol": "UDP",
      "timestamp": 1739635199600,
      "bytes": 64
    }
  ],
  "hasMore": false,
  "serverTimestamp": 1739635200000
}
```

**응답 필드 설명**:

| 필드 | 설명 |
|------|------|
| `agentId` | 에이전트 식별자 |
| `sequenceStart` | 반환된 첫 이벤트의 sequence number |
| `sequenceEnd` | 반환된 마지막 이벤트의 sequence number |
| `events` | 패킷 이벤트 배열 |
| `events[].seq` | 이벤트 고유 순서 번호 (monotonic 증가) |
| `events[].timestamp` | 에이전트 서버 기준 캡처 타임스탬프 (ms) |
| `hasMore` | limit에 걸려서 추가 이벤트가 남아있는지 여부 |
| `serverTimestamp` | 응답 생성 시점의 에이전트 서버 시각 (clock skew 계산용) |

**에러 응답**:
- `401 Unauthorized`: API 키 누락 또는 불일치
- `400 Bad Request`: 잘못된 파라미터

##### `GET /api/info`

에이전트 기본 정보. 콜렉터가 초기 등록 시 호출.

**응답 (200 OK)**:
```json
{
  "agentId": "web-server-01",
  "hostname": "ip-10-0-1-5",
  "version": "0.1.0",
  "mode": "live",
  "interface": "eth0",
  "supportedFeatures": ["events", "health"],
  "timestamp": 1739635200000
}
```

#### 패킷 이벤트 데이터 형식

에이전트가 캡처하는 개별 패킷 이벤트 형식은 기존과 동일하되, `seq` 필드가 추가된다.

```
{
  seq: number,           // monotonic sequence number (에이전트 내 고유)
  sourceIp: string,      // 출발지 IP
  destPort: number,      // 목적지 포트
  protocol: string,      // "TCP" | "UDP" | "ICMP"
  timestamp: number,     // 에이전트 서버 로컬 시각 (ms, Date.now())
  bytes: number          // 패킷 크기
}
```

#### Ring Buffer 동작

```
[oldest] [...]  [...] [newest]
   ^                     ^
   tail                 head

- addEvent(): head++ 위치에 저장. 버퍼 가득 차면 tail++도 함께 이동
- getEventsSince(seq): seq 이후의 이벤트를 순서대로 반환
- seq는 전체 수명 동안 단조 증가 (overflow 없음, Number.MAX_SAFE_INTEGER까지 충분)
```

#### 사용자 시나리오

**정상 흐름**:
1. 관리자가 원격 서버에 `ip-stargaze-agent`를 설치하고 설정 파일을 작성한다
2. `node agent.js` 또는 `npx ip-stargaze-agent`로 실행한다
3. 에이전트가 지정된 인터페이스에서 패킷 캡처를 시작한다
4. 캡처된 이벤트가 Ring Buffer에 누적된다
5. 중앙 콜렉터가 `GET /api/events?since=45000`으로 폴링한다
6. 에이전트가 seq 45001 이후의 이벤트를 JSON 배열로 응답한다
7. 콜렉터가 마지막 seq(45230)를 기억하고 다음 폴링에 사용한다

**예외 흐름**:
- pcap 권한 없음: 시뮬레이션 모드로 폴백 (기존 동작과 동일)
- Ring Buffer overflow: 오래된 이벤트 자동 폐기, 콜렉터의 `since` 값이 버퍼 범위 밖이면 현재 버퍼 전체 반환 + 경고 플래그(`gapDetected: true`)
- 콜렉터가 폴링하지 않음: 에이전트는 관계없이 계속 캡처, 버퍼만 순환

#### 수용 기준

- **AC-101**: Given 에이전트가 live 모드로 시작되었을 때, When `GET /api/health`를 호출하면, Then `status: "ok"`, `captureActive: true`를 반환한다
- **AC-102**: Given 에이전트에 10개 이벤트가 버퍼에 있고 seq 1~10일 때, When `GET /api/events?since=5`를 호출하면, Then seq 6~10인 5개 이벤트를 반환한다
- **AC-103**: Given API 키가 "test-key"로 설정되었을 때, When `Authorization: Bearer wrong-key`로 `/api/events`를 호출하면, Then 401 Unauthorized를 반환한다
- **AC-104**: Given Ring Buffer 용량이 100이고 150개 이벤트가 누적되었을 때, When `GET /api/events`를 호출하면, Then 최근 100개 이벤트만 반환된다
- **AC-105**: Given 콜렉터의 `since`가 버퍼에서 이미 폐기된 seq일 때, When 폴링하면, Then 현재 버퍼 전체를 반환하고 응답에 `gapDetected: true`를 포함한다

#### 제약사항 및 고려사항

- **경량성**: 에이전트는 Aggregator, WebSocket, 정적 파일 서빙을 포함하지 않는다. 오직 캡처 + 버퍼 + REST API만 담당한다
- **의존성 최소화**: 에이전트는 `fastify`만 사용 (D3.js, @fastify/websocket, @fastify/static 불필요)
- **메모리**: Ring Buffer 100,000 이벤트 * ~150 bytes = ~15MB (충분히 경량)
- **CPU**: tcpdump 파싱 부하는 기존과 동일
- **포트**: 기본 15119 (중앙 서버 15118과 구분)

#### 에이전트 설정 파일

파일: `agent.config.json` (또는 환경 변수)

```json
{
  "agentId": "web-server-01",
  "port": 15119,
  "host": "0.0.0.0",
  "mode": "live",
  "interface": "eth0",
  "apiKey": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "bufferCapacity": 100000,
  "logLevel": "info"
}
```

| 필드 | 환경변수 | 기본값 | 설명 |
|------|----------|--------|------|
| `agentId` | `AGENT_ID` | hostname | 에이전트 고유 식별자 |
| `port` | `AGENT_PORT` | 15119 | REST API 리스닝 포트 |
| `host` | `AGENT_HOST` | 0.0.0.0 | 바인딩 호스트 |
| `mode` | `AGENT_MODE` | simulation | `live` 또는 `simulation` |
| `interface` | `AGENT_INTERFACE` | eth0 | 캡처 인터페이스 (live 모드) |
| `apiKey` | `AGENT_API_KEY` | (필수) | API 인증 키 |
| `bufferCapacity` | `AGENT_BUFFER_CAPACITY` | 100000 | Ring Buffer 최대 이벤트 수 |

---

### 4.2 기능: Ring Buffer (F-031)

#### 개요
- **목적**: 에이전트가 캡처한 이벤트를 고정 크기 메모리 버퍼에 저장하여, 콜렉터의 폴링 간격 동안 이벤트 유실 없이 제공
- **사용자**: 시스템 내부 (에이전트 내부 모듈)
- **트리거**: 패킷 캡처 시 이벤트 추가, 폴링 시 이벤트 조회

#### 상세 요구사항

- **FR-111**: 고정 크기 배열 기반 circular buffer로 구현한다
- **FR-112**: 각 이벤트에 monotonic 증가 sequence number를 부여한다
  - 첫 이벤트 seq = 1, 이후 +1씩 증가
  - 에이전트 재시작 시 seq는 1부터 다시 시작 (stateless)
- **FR-113**: `push(event)`: 이벤트 추가. 버퍼 초과 시 가장 오래된 이벤트 폐기
- **FR-114**: `getSince(seq, limit)`: 특정 seq 이후의 이벤트를 최대 limit개 반환
- **FR-115**: `getAll(limit)`: 버퍼 내 전체 이벤트를 limit개까지 반환
- **FR-116**: 현재 버퍼 상태 (size, capacity, oldestSeq, newestSeq) 조회 가능

#### 수용 기준

- **AC-111**: Given 용량 5인 버퍼에 7개 이벤트를 push했을 때, When getSince(0)을 호출하면, Then seq 3, 4, 5, 6, 7인 5개 이벤트를 반환한다
- **AC-112**: Given 버퍼에 seq 10~20이 있을 때, When getSince(15, 3)을 호출하면, Then seq 16, 17, 18인 3개 이벤트를 반환한다
- **AC-113**: Given 빈 버퍼에서, When getSince(0)을 호출하면, Then 빈 배열을 반환한다

---

### 4.3 기능: 중앙 콜렉터 (RemoteCollector) (F-032)

#### 개요
- **목적**: 등록된 원격 에이전트를 주기적으로 폴링하여 패킷 이벤트를 수집하고, 기존 Aggregator에 주입
- **사용자**: 시스템 내부 (중앙 서버의 데이터 수집 레이어)
- **트리거**: 설정된 폴링 주기마다 자동 실행

#### 상세 요구사항

- **FR-121**: 설정 파일 또는 런타임 API로 에이전트 목록을 관리한다
  - 각 에이전트 등록 정보: `{ url, apiKey, label, enabled }`
- **FR-122**: 설정된 주기(기본 2초)마다 모든 활성 에이전트를 병렬 폴링한다
  - 각 에이전트에 `GET /api/events?since={lastSeq}&limit=10000` 요청
  - `lastSeq`는 에이전트별로 관리
- **FR-123**: 폴링된 이벤트를 Aggregator.addEvent()에 주입한다
  - 이벤트에 `source` 필드를 추가하여 출처를 구분한다
    - `{ source: "local" }` vs `{ source: "remote", agentId: "web-server-01" }`
- **FR-124**: 에이전트별 헬스 상태를 추적한다
  - 상태: `online`, `degraded`, `offline`
  - `online`: 마지막 폴링 성공
  - `degraded`: 최근 3회 중 1~2회 실패
  - `offline`: 최근 3회 연속 실패
- **FR-125**: 타임스탬프 보정(clock skew compensation)을 수행한다
  - 폴링 응답의 `serverTimestamp`와 로컬 `Date.now()`의 차이를 계산
  - 이벤트의 `timestamp`에 offset을 적용하여 중앙 서버 시간 기준으로 정규화
  - 이동 평균(exponential moving average)으로 offset을 부드럽게 유지
- **FR-126**: 에이전트 연결 실패 시 재시도 및 백오프 적용
  - 폴링 타임아웃: 5초
  - 연속 실패 시 폴링 간격 증가 (2초 -> 4초 -> 8초 -> 최대 30초)
  - 복구 시 원래 간격으로 즉시 복원
- **FR-127**: 에이전트 추가/제거/활성화/비활성화를 런타임에 수행할 수 있다
  - WebSocket 메시지로 클라이언트에서 제어
- **FR-128**: 폴링 결과에 `gapDetected: true`가 포함되면 로그 경고를 출력한다
  - 이벤트 유실이 발생했음을 의미 (폴링 간격 대비 트래픽이 과다)

#### 폴링 흐름 다이어그램

```
[RemoteCollector]
     |
     |--- 2초 타이머 ---
     |                  |
     v                  v
 [Agent A]          [Agent B]
  GET /api/events    GET /api/events
  ?since=1000        ?since=500
     |                  |
     v                  v
 200 OK              200 OK
 events[1001..1050]  events[501..520]
     |                  |
     +--------+---------+
              |
              v
     timestamp 보정 (clock skew)
              |
              v
     source 필드 추가
     { source: "remote", agentId: "..." }
              |
              v
     aggregator.addEvent() x N
              |
              v
     다음 폴링 시 lastSeq 업데이트
     Agent A: 1050, Agent B: 520
```

#### 에이전트 등록 데이터 구조

```json
{
  "agents": [
    {
      "id": "web-server-01",
      "url": "http://10.0.1.5:15119",
      "apiKey": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "label": "Web Server (Production)",
      "enabled": true
    },
    {
      "id": "db-server-01",
      "url": "http://10.0.2.10:15119",
      "apiKey": "x9y8z7w6-v5u4-3210-fedc-ba0987654321",
      "label": "DB Server (MySQL)",
      "enabled": true
    }
  ],
  "pollingIntervalMs": 2000,
  "pollingTimeoutMs": 5000,
  "maxEventsPerPoll": 10000
}
```

#### Clock Skew 보정 알고리즘

```
1. 폴링 요청 전 localSendTime = Date.now()
2. 응답 수신 후 localRecvTime = Date.now()
3. 응답의 serverTimestamp를 읽음
4. RTT = localRecvTime - localSendTime
5. estimatedServerNow = serverTimestamp + (RTT / 2)
6. clockOffset = localRecvTime - estimatedServerNow
7. 보정된 이벤트 타임스탬프 = event.timestamp + clockOffset

EMA 적용 (alpha = 0.2):
  smoothedOffset = alpha * newOffset + (1 - alpha) * prevSmoothedOffset

첫 폴링 시에는 newOffset을 그대로 사용.
|clockOffset| > 30초인 경우 경고 로그 출력 (NTP 미동기화 가능성).
```

#### 사용자 시나리오

**정상 흐름**:
1. 관리자가 중앙 서버 설정 파일에 에이전트 목록을 등록한다
2. 중앙 서버 시작 시 `RemoteCollector`가 초기화된다
3. 각 에이전트에 `GET /api/info`로 초기 정보를 수집한다
4. 2초마다 모든 활성 에이전트를 병렬 폴링한다
5. 폴링된 이벤트에 clock skew 보정 + source 태깅 후 Aggregator에 주입한다
6. Aggregator의 기존 1초 주기 스냅샷에 원격 이벤트가 자연스럽게 포함된다
7. Star 그래프에 로컬+원격 트래픽이 통합 표시된다

**예외 흐름**:
- 에이전트 응답 타임아웃: 해당 에이전트 상태를 `degraded`로 변경, 다음 폴링에서 재시도
- 3회 연속 실패: 상태 `offline`, 폴링 간격 증가
- 에이전트 복구: 다음 성공 폴링 시 상태 `online`, 간격 복원
- `gapDetected`: 로그 경고 + UI에 해당 에이전트 "gap" 아이콘 표시

#### 수용 기준

- **AC-121**: Given 2개 에이전트가 등록되고 활성 상태일 때, When 2초가 경과하면, Then 두 에이전트에 병렬로 폴링 요청이 발생한다
- **AC-122**: Given 에이전트 A에서 50개 이벤트를 폴링했을 때, When Aggregator 스냅샷이 생성되면, Then 해당 이벤트가 통계에 반영된다
- **AC-123**: Given 에이전트 B가 3회 연속 응답 실패했을 때, When 상태를 확인하면, Then `offline`이며 폴링 간격이 증가된 상태이다
- **AC-124**: Given 에이전트 서버의 시계가 중앙 서버보다 5초 빠를 때, When 이벤트를 폴링하면, Then 이벤트의 timestamp가 ~5초 보정되어 Aggregator에 주입된다
- **AC-125**: Given UI에서 에이전트를 비활성화했을 때, When 다음 폴링 주기가 되면, Then 해당 에이전트는 폴링하지 않는다

#### 제약사항 및 고려사항

- **네트워크**: 에이전트당 폴링 1회의 데이터 크기 = 최대 ~1.5MB (10,000 이벤트 * ~150 bytes)
- **Aggregator 부하**: 2초마다 최대 20 에이전트 * 10,000 이벤트 = 200,000 이벤트 주입 가능. 고 트래픽 시 limit 조절 필요
- **Node.js fetch**: Node.js 18+ 내장 fetch 사용 (추가 의존성 없음)

---

### 4.4 기능: Aggregator 확장 - 소스 구분 (F-033)

#### 개요
- **목적**: Aggregator가 로컬과 원격 이벤트를 구분하여 저장하고, 스냅샷에 소스 정보를 포함
- **사용자**: 시스템 내부 + 프론트엔드 (소스별 필터링/표시)
- **트리거**: 이벤트 추가 시

#### 상세 요구사항

- **FR-131**: `addEvent()` 호출 시 `source` 필드를 이벤트에 포함한다
  - 기존 로컬 이벤트: `{ source: "local" }` (기본값)
  - 원격 이벤트: `{ source: "remote", agentId: "web-server-01" }`
- **FR-132**: 스냅샷에 소스별 요약 통계를 추가한다
  - `snapshot.sources`: 활성 소스 목록 + 소스별 패킷 수
- **FR-133**: 서브넷별 통계에 소스 분포를 포함한다 (선택적 확장)
  - 각 subnet 항목에 `sourceBreakdown: { "local": 500, "web-server-01": 200 }`
- **FR-134**: 기존 로컬-only 동작과 100% 하위 호환된다
  - 원격 에이전트가 없으면 기존과 동일하게 동작
  - `source` 필드 미지정 시 `"local"`로 간주

#### 확장된 스냅샷 데이터 구조

기존 스냅샷에 `sources` 섹션이 추가된다.

```json
{
  "timestamp": 1739635200000,
  "window": "5m",
  "subnetLevel": "/16",
  "summary": {
    "totalPackets": 25000,
    "totalUniqueIps": 1500,
    "totalPps": 83.3,
    "topSubnets": [...]
  },
  "sources": {
    "local": {
      "packets": 15000,
      "uniqueIps": 900,
      "status": "active"
    },
    "web-server-01": {
      "packets": 7000,
      "uniqueIps": 400,
      "status": "online",
      "label": "Web Server (Production)"
    },
    "db-server-01": {
      "packets": 3000,
      "uniqueIps": 200,
      "status": "online",
      "label": "DB Server (MySQL)"
    }
  },
  "subnets": [
    {
      "network": "192.168.0.0/16",
      "count": 5000,
      "uniqueIps": 300,
      "bytes": 7100000,
      "pps": 16.7,
      "isPrivate": true,
      "topIps": [...],
      "protocols": { "TCP": 3000, "UDP": 1500, "ICMP": 500 }
    }
  ]
}
```

#### 수용 기준

- **AC-131**: Given 로컬에서 100개, 원격 에이전트에서 50개 이벤트가 추가되었을 때, When 스냅샷을 생성하면, Then `summary.totalPackets`는 150이고, `sources`에 로컬과 원격이 각각 표시된다
- **AC-132**: Given 원격 에이전트가 등록되지 않았을 때, When 스냅샷을 생성하면, Then 기존과 동일한 형식이며 `sources`에 `"local"`만 포함된다
- **AC-133**: Given `source` 필드 없이 `addEvent()`를 호출했을 때, When 내부적으로 저장되면, Then `source`는 `"local"`로 설정된다

---

### 4.5 기능: 에이전트 관리 UI (F-034)

#### 개요
- **목적**: 브라우저에서 원격 에이전트를 추가/제거/활성화/비활성화하고 상태를 확인
- **사용자**: 모니터링 담당자
- **트리거**: 사용자 조작 (UI 컨트롤)

#### 상세 요구사항

- **FR-141**: System 컨트롤 그룹 내에 "Agents" 버튼을 추가한다
  - 클릭 시 에이전트 관리 패널(모달 또는 슬라이드 패널)이 열린다
- **FR-142**: 에이전트 목록을 표시한다
  - 각 항목: 상태 아이콘(초록/노랑/빨강) + label + agentId + URL + 패킷 수
  - 로컬 소스도 목록 최상단에 표시 (항상 존재, 제거 불가)
- **FR-143**: 에이전트 추가 폼을 제공한다
  - 필드: URL, API Key, Label
  - "Test Connection" 버튼: 입력한 URL로 `/api/health` 호출하여 연결 확인
  - "Add" 버튼: 에이전트를 등록하고 폴링 시작
- **FR-144**: 에이전트별 컨텍스트 메뉴 또는 버튼
  - Enable/Disable 토글
  - Remove (확인 다이얼로그 후 삭제)
- **FR-145**: 에이전트 상태가 변경되면 실시간 반영 (스냅샷과 함께 전달)

#### UI 레이아웃

```
+====================================+
|  Agents                        [X] |
+====================================+
| [*] Local (this server)            |
|     Packets: 15,000 | PPS: 50.0   |
|     Status: active                 |
+------------------------------------+
| [*] web-server-01                  |
|     Web Server (Production)        |
|     http://10.0.1.5:15119          |
|     Packets: 7,000 | PPS: 23.3    |
|     Status: online          [v][x] |
+------------------------------------+
| [!] db-server-01                   |
|     DB Server (MySQL)              |
|     http://10.0.2.10:15119         |
|     Packets: 0 | PPS: 0           |
|     Status: offline         [v][x] |
+------------------------------------+
|                                    |
| + Add Agent                        |
|   URL:     [http://...         ]   |
|   API Key: [***                ]   |
|   Label:   [My Server          ]   |
|   [Test Connection] [Add]          |
+====================================+
```

상태 아이콘:
- `[*]` 초록: online/active
- `[!]` 노랑: degraded
- `[x]` 빨강: offline

#### WebSocket 메시지 확장

**클라이언트 -> 서버** (새 메시지 타입):

```json
{ "type": "addAgent", "value": { "url": "http://10.0.1.5:15119", "apiKey": "...", "label": "Web Server" } }
{ "type": "removeAgent", "value": { "id": "web-server-01" } }
{ "type": "setAgentEnabled", "value": { "id": "web-server-01", "enabled": false } }
{ "type": "testAgent", "value": { "url": "http://10.0.1.5:15119", "apiKey": "..." } }
{ "type": "getAgents" }
```

**서버 -> 클라이언트** (새 메시지 타입):

```json
{ "type": "agents", "data": [ { "id": "web-server-01", "url": "...", "label": "...", "enabled": true, "status": "online", "packets": 7000 }, ... ] }
{ "type": "testAgentResult", "data": { "success": true, "agentId": "web-server-01", "info": { ... } } }
{ "type": "testAgentResult", "data": { "success": false, "error": "Connection refused" } }
```

#### 수용 기준

- **AC-141**: Given 에이전트 관리 패널이 열려 있을 때, When 등록된 에이전트 2개가 있으면, Then 로컬 포함 총 3개 항목이 표시된다
- **AC-142**: Given URL과 API Key를 입력하고 "Test Connection"을 클릭했을 때, When 에이전트가 정상 응답하면, Then 성공 메시지와 에이전트 정보가 표시된다
- **AC-143**: Given 에이전트를 "Add"했을 때, When 다음 폴링 주기가 되면, Then 해당 에이전트의 이벤트가 스냅샷에 반영된다
- **AC-144**: Given 에이전트를 Disable했을 때, When 스냅샷을 확인하면, Then 해당 에이전트의 이벤트가 더 이상 포함되지 않는다

---

### 4.6 기능: 대시보드 소스 표시 (F-035)

#### 개요
- **목적**: 대시보드에서 각 데이터 소스(로컬 + 원격 에이전트)의 기여도를 시각적으로 표시
- **사용자**: 모니터링 담당자
- **트리거**: 스냅샷 수신 시 자동 업데이트

#### 상세 요구사항

- **FR-151**: Info 바에 활성 소스 수를 표시한다
  - 예: "3 sources" (local + 2 agents)
- **FR-152**: 대시보드 하단 또는 Info 바에 소스별 미니 바(비율 바)를 표시한다
  - 프로토콜 미니바와 유사한 스타일
  - 각 소스에 고유 색상 할당
  - 호버 시 소스명 + 패킷 수 + 비율 표시
- **FR-153**: 소스가 1개(local only)일 때는 소스 관련 UI를 표시하지 않는다
  - 기존 단일 서버 사용자에게 불필요한 UI 노출 방지

#### 수용 기준

- **AC-151**: Given 원격 에이전트가 없을 때, When 대시보드를 확인하면, Then 소스 관련 표시가 없다 (기존과 동일)
- **AC-152**: Given 로컬 + 2개 에이전트가 활성일 때, When Info 바를 확인하면, Then "3 sources" 텍스트와 비율 바가 표시된다

---

### 4.7 기능: Star 그래프 소스 시각적 구분 (F-036)

#### 개요
- **목적**: Star 그래프에서 트래픽의 출처(어느 서버에서 온 것인지)를 시각적으로 구분 가능하게 함
- **사용자**: 모니터링 담당자
- **트리거**: 스냅샷 수신 시 그래프 업데이트

#### 상세 요구사항

- **FR-161**: Hub 노드를 소스 수에 따라 확장한다
  - 단일 소스: 기존 단일 Hub
  - 다중 소스: Hub 내부를 소스별 색상으로 파이(pie) 분할 (트래픽 비율 기반)
- **FR-162**: 소스가 1개일 때는 기존 Hub 표시와 동일하다 (변경 없음)
- **FR-163**: Hub 호버 시 소스별 통계 툴팁을 표시한다
  - 각 소스: label + 패킷 수 + PPS

#### 수용 기준

- **AC-161**: Given 3개 소스가 활성이고 트래픽 비율이 60:30:10일 때, When Hub를 확인하면, Then 3가지 색상으로 파이 분할되어 표시된다
- **AC-162**: Given 소스가 local 1개뿐일 때, When Hub를 확인하면, Then 기존과 동일한 단색 Hub이다

---

### 4.8 기능: 에이전트 설정 영속화 (F-037)

#### 개요
- **목적**: 등록된 에이전트 목록을 파일에 저장하여 서버 재시작 시에도 유지
- **사용자**: 시스템 (자동)
- **트리거**: 에이전트 추가/제거/수정 시

#### 상세 요구사항

- **FR-171**: 에이전트 목록을 JSON 파일(`agents.json`)에 저장한다
  - 저장 경로: 프로젝트 루트 또는 사용자 지정 경로
  - 저장 시점: 에이전트 추가/제거/수정 직후
- **FR-172**: 서버 시작 시 `agents.json`을 읽어 에이전트 목록을 복원한다
  - 파일 없으면 빈 목록으로 시작 (에러 아님)
- **FR-173**: API 키는 파일에 저장된다 (파일 권한 600 권장, README에 안내)
- **FR-174**: `.gitignore`에 `agents.json`을 추가한다 (API 키 포함이므로)

#### 저장 형식

파일: `agents.json`

```json
{
  "agents": [
    {
      "id": "web-server-01",
      "url": "http://10.0.1.5:15119",
      "apiKey": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "label": "Web Server (Production)",
      "enabled": true
    }
  ],
  "settings": {
    "pollingIntervalMs": 2000
  }
}
```

#### 수용 기준

- **AC-171**: Given 에이전트 2개가 등록된 상태에서, When 서버를 재시작하면, Then 2개 에이전트가 자동 복원되고 폴링이 재개된다
- **AC-172**: Given `agents.json`이 존재하지 않을 때, When 서버를 시작하면, Then 에이전트 없이 정상 동작한다 (로컬 only)

---

## 5. 프로젝트 구조 변경

### 5.1 추가되는 파일

```
ip-stargaze/
├── src/
│   ├── agent/                          # (신규) 에이전트 프로세스
│   │   ├── index.js                    # 에이전트 진입점
│   │   ├── agentConfig.js              # 에이전트 설정 로딩
│   │   ├── eventBuffer.js              # Ring Buffer 구현
│   │   └── routes.js                   # REST API 라우트 (/api/health, /api/events, /api/info)
│   ├── server/
│   │   ├── remote/                     # (신규) 콜렉터 모듈
│   │   │   ├── remoteCollector.js      # 폴링 오케스트레이터
│   │   │   ├── agentConnection.js      # 개별 에이전트 연결 관리
│   │   │   ├── clockSync.js            # Clock skew 보정
│   │   │   └── agentStore.js           # 에이전트 목록 관리 + 영속화
│   │   ├── ws/
│   │   │   ├── wsHandler.js            # (수정) 에이전트 관리 메시지 핸들링 추가
│   │   │   └── messageValidator.js     # (수정) 에이전트 관련 검증 추가
│   │   ├── analysis/
│   │   │   └── aggregator.js           # (수정) source 필드 처리, sources 통계
│   │   ├── config.js                   # (수정) 에이전트 관련 설정 추가
│   │   └── index.js                    # (수정) RemoteCollector 초기화 추가
│   ├── shared/
│   │   └── protocol.js                 # (수정) 에이전트 관련 메시지 타입 추가
│   └── client/
│       ├── js/
│       │   ├── app.js                  # (수정) 에이전트 관리 메시지 핸들링
│       │   ├── agentPanel.js           # (신규) 에이전트 관리 UI
│       │   └── dashboard.js            # (수정) 소스 표시 추가
│       └── css/
│           └── style.css               # (수정) 에이전트 패널 스타일
├── agents.json                         # (신규, gitignored) 에이전트 설정 영속화
├── agent.config.json.example           # (신규) 에이전트 설정 예시
└── test/
    ├── eventBuffer.test.js             # (신규) Ring Buffer 테스트
    ├── remoteCollector.test.js         # (신규) 콜렉터 테스트
    ├── clockSync.test.js               # (신규) Clock skew 보정 테스트
    └── agentStore.test.js              # (신규) 에이전트 저장소 테스트
```

### 5.2 수정되는 기존 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/server/index.js` | RemoteCollector 초기화, shutdown에 collector.destroy() 추가 |
| `src/server/config.js` | 에이전트 관련 설정 필드 추가 |
| `src/server/analysis/aggregator.js` | source 필드 처리, buildSnapshot에 sources 섹션 추가 |
| `src/server/ws/wsHandler.js` | 에이전트 관리 메시지 핸들링 (addAgent, removeAgent 등) |
| `src/server/ws/messageValidator.js` | 에이전트 관련 입력 검증 함수 추가 |
| `src/shared/protocol.js` | 에이전트 관련 메시지 타입 상수 추가 |
| `src/client/js/app.js` | 에이전트 메시지 핸들링, agentPanel 연동 |
| `src/client/js/dashboard.js` | sources 미니 바 표시 |
| `src/client/css/style.css` | 에이전트 패널 스타일 추가 |
| `package.json` | agent 실행 스크립트 추가 |
| `.gitignore` | `agents.json` 추가 |

### 5.3 재사용되는 기존 모듈 (에이전트에서)

에이전트 프로세스는 다음 기존 모듈을 직접 import하여 재사용한다.

| 모듈 | 에이전트 내 용도 |
|------|----------------|
| `src/server/capture/captureManager.js` | 패킷 캡처 관리 (simulator/pcap) |
| `src/server/capture/simulator.js` | 시뮬레이션 모드 |
| `src/server/capture/pcapCapture.js` | 실제 캡처 모드 |
| `src/server/analysis/ipClassifier.js` | IP 분류 (에이전트 측에서는 사용하지 않으나, 콜렉터 측에서 사용) |

참고: 에이전트는 `ipClassifier`를 사용하지 않는다. IP 분류는 중앙 서버의 Aggregator.addEvent() 흐름에서 수행된다. 에이전트는 raw 패킷 이벤트만 버퍼에 저장하고 전달한다.

---

## 6. 설정 변경 사항

### 6.1 중앙 서버 config.js 확장

```javascript
const config = {
  // ... 기존 설정 유지 ...

  // 에이전트 관련 설정 (신규)
  agentsFilePath: process.env.AGENTS_FILE || './agents.json',
  defaultPollingIntervalMs: parseInt(process.env.POLLING_INTERVAL, 10) || 2000,
  pollingTimeoutMs: parseInt(process.env.POLLING_TIMEOUT, 10) || 5000,
  maxEventsPerPoll: parseInt(process.env.MAX_EVENTS_PER_POLL, 10) || 10000,
  maxAgents: 20,
  agentHealthThreshold: 3,  // 연속 실패 횟수 -> offline 판정
};
```

### 6.2 package.json 스크립트 추가

```json
{
  "scripts": {
    "start": "node src/server/index.js",
    "start:agent": "node src/agent/index.js",
    "dev": "node --watch src/server/index.js",
    "dev:agent": "node --watch src/agent/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

## 7. 프로토콜 확장 (shared/protocol.js)

```javascript
export const MSG = {
  // ... 기존 메시지 타입 유지 ...

  // 에이전트 관리 (신규)
  ADD_AGENT: 'addAgent',
  REMOVE_AGENT: 'removeAgent',
  SET_AGENT_ENABLED: 'setAgentEnabled',
  TEST_AGENT: 'testAgent',
  GET_AGENTS: 'getAgents',
  AGENTS: 'agents',
  TEST_AGENT_RESULT: 'testAgentResult',
};
```

---

## 8. 구현 로드맵

### Phase 4A: 에이전트 인프라 (예상 기간: 2-3일)

| 순서 | 작업 | 의존성 | 산출물 |
|------|------|--------|--------|
| 4A-1 | EventBuffer (Ring Buffer) 구현 + 테스트 | 없음 | `eventBuffer.js`, `eventBuffer.test.js` |
| 4A-2 | 에이전트 설정 로딩 (`agentConfig.js`) | 없음 | `agentConfig.js` |
| 4A-3 | 에이전트 REST API 라우트 (`routes.js`) | 4A-1 | `routes.js` |
| 4A-4 | 에이전트 진입점 (`index.js`) | 4A-2, 4A-3 | `src/agent/index.js` |
| 4A-5 | API 키 인증 미들웨어 | 4A-3 | `routes.js` 내 |
| 4A-6 | 에이전트 통합 테스트 (curl/httpie로 수동 검증) | 4A-4 | 동작 확인 |

### Phase 4B: 콜렉터 + Aggregator 통합 (예상 기간: 3-4일)

| 순서 | 작업 | 의존성 | 산출물 |
|------|------|--------|--------|
| 4B-1 | ClockSync 모듈 구현 + 테스트 | 없음 | `clockSync.js`, `clockSync.test.js` |
| 4B-2 | AgentStore 모듈 (목록 관리 + 영속화) + 테스트 | 없음 | `agentStore.js`, `agentStore.test.js` |
| 4B-3 | AgentConnection 모듈 (개별 에이전트 폴링) | 4B-1 | `agentConnection.js` |
| 4B-4 | RemoteCollector 오케스트레이터 + 테스트 | 4B-2, 4B-3 | `remoteCollector.js`, `remoteCollector.test.js` |
| 4B-5 | Aggregator 확장 (source 필드, sources 통계) | 없음 | `aggregator.js` 수정 |
| 4B-6 | protocol.js 확장 + messageValidator 확장 | 없음 | 수정 |
| 4B-7 | WsHandler 확장 (에이전트 관리 메시지) | 4B-4, 4B-6 | `wsHandler.js` 수정 |
| 4B-8 | index.js 통합 (RemoteCollector 초기화) | 4B-4, 4B-7 | `index.js` 수정 |
| 4B-9 | End-to-end 테스트 (에이전트 + 중앙 서버) | 4B-8 | 통합 동작 확인 |

### Phase 4C: UI 변경 (예상 기간: 2-3일)

| 순서 | 작업 | 의존성 | 산출물 |
|------|------|--------|--------|
| 4C-1 | agentPanel.js 구현 (에이전트 관리 패널) | Phase 4B | `agentPanel.js` |
| 4C-2 | app.js 수정 (에이전트 메시지 핸들링) | 4C-1 | `app.js` 수정 |
| 4C-3 | dashboard.js 수정 (소스 미니 바) | Phase 4B | `dashboard.js` 수정 |
| 4C-4 | style.css 추가 (에이전트 패널 스타일) | 4C-1 | `style.css` 수정 |
| 4C-5 | Star 그래프 Hub 파이 분할 (선택) | Phase 4B | `starGraph.js` 수정 |
| 4C-6 | 전체 UI 통합 테스트 | 4C-1~4C-5 | 완성 |

---

## 9. 리스크 분석 및 완화 전략

| # | 리스크 | 영향도 | 발생 확률 | 완화 전략 |
|---|--------|--------|----------|----------|
| R-10 | 에이전트 폴링 지연으로 데이터 갭 발생 | 중간 | 중간 | Ring Buffer 크기 충분히 확보 (100K 이벤트 = ~15분 분량 at 100 PPS). gapDetected 경고로 운영자 인지 |
| R-11 | Clock skew가 큰 경우 (>30초) 시계열 왜곡 | 높음 | 낮음 | EMA 보정 + 임계치 초과 시 경고 로그. NTP 설정 권장 문서화 |
| R-12 | 다수 에이전트 동시 폴링 시 중앙 서버 CPU 부하 | 중간 | 낮음 | 폴링을 staggering (에이전트마다 오프셋 적용). 최대 에이전트 수 제한 (20대) |
| R-13 | 네트워크 단절 시 에이전트 이벤트 유실 | 중간 | 중간 | Ring Buffer가 폴링 재개까지 이벤트 보존. 긴 단절 시 gapDetected로 알림 |
| R-14 | 에이전트 API 키 탈취 | 높음 | 낮음 | HTTPS 사용 권장 (문서화). 키 로테이션 기능은 추후 확장. 네트워크 격리(VPN) 권장 |
| R-15 | Aggregator 메모리 과다 사용 (다수 에이전트 고트래픽) | 중간 | 중간 | maxEventsPerPoll 제한. 1시간 윈도우 사용 시 주의 사항 문서화 |

---

## 10. 비기능 요구사항 (추가분)

| 항목 | 요구사항 |
|------|---------|
| 성능 | 에이전트 REST API 응답 시간 < 200ms (10,000 이벤트 기준) |
| 성능 | 폴링 1회 전체 소요 시간 < 3초 (20 에이전트 병렬) |
| 가용성 | 개별 에이전트 장애가 전체 시스템에 영향 없음 |
| 가용성 | 에이전트 offline 감지 < 10초 (3회 * 2초 폴링 + 알파) |
| 확장성 | 최대 20대 에이전트 동시 모니터링 |
| 보안 | API 키 기반 인증 (Bearer token) |
| 보안 | `agents.json` 파일에 민감 정보 포함, gitignore 필수 |
| 하위 호환 | 에이전트 미등록 시 기존과 100% 동일 동작 |
| 운영 | 에이전트 추가/제거 시 서버 재시작 불필요 |

---

## 11. 보안 고려사항 상세

### 11.1 인증

| 구분 | 방식 | 설명 |
|------|------|------|
| Phase 4 (첫 구현) | API Key (Bearer Token) | 단순하고 구현 빠름. 내부 네트워크 전제 |
| 추후 확장 | HTTPS + API Key | TLS 암호화 추가 |
| 추후 확장 | mTLS (상호 인증) | 에이전트와 콜렉터 양방향 인증서 검증 |

### 11.2 API Key 관리

- 에이전트와 콜렉터 양쪽에 동일한 키를 설정한다
- UUID v4 형식 권장 (`crypto.randomUUID()`)
- 키는 환경 변수 또는 설정 파일로 제공 (코드에 하드코딩 금지)
- `agents.json`은 `.gitignore`에 포함 (API 키 노출 방지)

### 11.3 네트워크 보안

- 에이전트 포트(15119)는 중앙 서버 IP에서만 접근 가능하도록 방화벽 설정 권장
- VPN 또는 프라이빗 네트워크 내 통신 권장
- 에이전트 API는 읽기 전용 (GET만 제공), 에이전트 설정 변경 불가

---

## 12. 용어 사전 (추가분)

| 용어 | 설명 |
|------|------|
| Agent (에이전트) | 감시 대상 원격 서버에서 실행되는 경량 패킷 수집 프로세스 |
| Collector (콜렉터) | 중앙 서버에서 에이전트를 폴링하여 데이터를 수집하는 모듈 |
| Ring Buffer | 고정 크기 순환 버퍼. 가장 오래된 데이터를 자동 폐기하며 메모리 사용량 일정 유지 |
| Polling (폴링) | 주기적으로 대상에 요청을 보내 데이터를 가져오는 방식 (push 대비 pull) |
| Clock Skew | 서로 다른 서버 간 시스템 시계의 차이 |
| Sequence Number | 이벤트에 부여되는 단조 증가 고유 번호. 폴링 시 마지막 수신 위치 추적용 |
| Gap Detection | 폴링 간격 동안 Ring Buffer overflow가 발생하여 일부 이벤트가 유실된 것을 감지 |
| Staggering | 다수 에이전트의 폴링 시점을 분산시켜 동시 부하를 줄이는 기법 |
| EMA | Exponential Moving Average. 시계열 데이터를 부드럽게 평활화하는 방법 |

---

## 13. FAQ / 설계 결정 근거

### Q1. 왜 WebSocket이 아닌 REST API + 폴링인가?

**결정**: 에이전트는 REST API, 중앙 서버가 폴링

**근거**:
1. **Additive 구조**: 기존 중앙 서버 코드를 최소한으로 변경. 에이전트는 독립적인 HTTP 서버
2. **장애 격리**: 에이전트가 다운되어도 콜렉터가 다음 폴링에서 감지. WebSocket은 연결 관리 복잡
3. **방화벽 친화**: 에이전트가 인바운드 포트만 열면 됨. 콜렉터->에이전트 방향으로 연결
4. **구현 단순성**: stateless HTTP GET은 구현과 디버깅이 쉬움
5. **사용자 요청**: "폴링해와서" - 사용자가 폴링 방식을 명시적으로 선호

**트레이드오프**: WebSocket 대비 2초 폴링 간격만큼의 데이터 지연이 발생하지만, 모니터링 도구 특성상 허용 가능한 수준

### Q2. 왜 에이전트에서 IP 분류를 하지 않는가?

**결정**: 에이전트는 raw 패킷 이벤트만 수집/전달, IP 분류는 중앙 서버에서 수행

**근거**:
1. **에이전트 경량 유지**: 분류 로직은 중앙 서버의 Aggregator.addEvent() 흐름에서 자연스럽게 수행됨
2. **일관성**: 모든 분류 규칙이 중앙에서 관리되므로 에이전트별로 불일치 없음
3. **유연성**: KNOWN_LABELS 등 분류 기준 변경 시 중앙 서버만 업데이트하면 됨
4. **대역폭**: 분류 결과를 포함하면 이벤트 크기가 3~4배 증가

### Q3. 폴링 간격 2초의 근거는?

**결정**: 기본 2초, 설정 가능

**근거**:
1. 중앙 서버의 스냅샷 주기가 1초이므로, 2초 폴링이면 매 스냅샷에 최대 1회 폴링 데이터가 누적 반영
2. 100 PPS 기준 2초 = 200 이벤트 → 매우 가벼운 HTTP 응답
3. 1000 PPS 기준 2초 = 2,000 이벤트 → 여전히 ~300KB 이하
4. 폴링 간격이 짧을수록 실시간성은 좋지만 네트워크/CPU 부하 증가
5. 모니터링 도구 특성상 2초 지연은 사용자가 체감하기 어려움

### Q4. API 키만으로 보안이 충분한가?

**결정**: Phase 4에서는 API 키 + 내부 네트워크 전제. 추후 HTTPS/mTLS 확장

**근거**:
1. 소~중규모 내부 도구 성격에 적합한 수준
2. VPN 또는 프라이빗 네트워크 내 사용 전제
3. 에이전트 API는 읽기 전용이므로 탈취 시 영향도가 제한적 (트래픽 통계 유출 수준)
4. 구현 복잡도 대비 적절한 보안 수준

---

## 14. 요약

| 항목 | 내용 |
|------|------|
| **핵심 변경** | 단일 서버 모니터링 -> 다중 서버 분산 모니터링 |
| **아키텍처** | Agent(에이전트 REST API) + Collector(중앙 폴링) + 기존 Aggregator 통합 |
| **신규 프로세스** | `ip-stargaze-agent` (독립 Node.js 프로세스) |
| **신규 모듈** | EventBuffer, RemoteCollector, AgentConnection, ClockSync, AgentStore, AgentPanel |
| **기존 수정** | Aggregator(source 필드), WsHandler(에이전트 메시지), dashboard(소스 표시) |
| **데이터 흐름** | 에이전트 캡처 -> Ring Buffer -> REST API -> 콜렉터 폴링 -> Aggregator -> 스냅샷 -> 브라우저 |
| **통신** | HTTP REST (폴링), Bearer Token 인증 |
| **하위 호환** | 에이전트 미등록 시 기존과 100% 동일 동작 |
| **예상 기간** | Phase 4A(2-3일) + 4B(3-4일) + 4C(2-3일) = 약 7-10일 |
| **최대 규모** | 에이전트 20대, 에이전트당 100K 이벤트 버퍼 |
