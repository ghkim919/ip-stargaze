# IP Stargaze 사용자 매뉴얼

---

## 목차

1. [개요](#1-개요)
2. [설치 및 시작](#2-설치-및-시작)
3. [화면 구성](#3-화면-구성)
4. [컨트롤 바 사용법](#4-컨트롤-바-사용법)
5. [Star 그래프 상호작용](#5-star-그래프-상호작용)
6. [시각화 설정 패널](#6-시각화-설정-패널)
7. [서버 설정 가이드](#7-서버-설정-가이드)
8. [분산 모니터링 설정](#8-분산-모니터링-설정)
9. [Docker 사용법](#9-docker-사용법)
10. [개발자 가이드](#10-개발자-가이드)
11. [문제 해결](#11-문제-해결-troubleshooting)
12. [용어 사전](#12-용어-사전)
- [부록 A: 환경변수 전체 레퍼런스](#부록-a-환경변수-전체-레퍼런스)
- [부록 B: WebSocket 메시지 프로토콜 전체 레퍼런스](#부록-b-websocket-메시지-프로토콜-전체-레퍼런스)
- [부록 C: 시각화 설정 파라미터 전체 레퍼런스](#부록-c-시각화-설정-파라미터-전체-레퍼런스)

---

## 1. 개요

### IP Stargaze란?

IP Stargaze는 실시간 IP 트래픽을 Star 그래프로 시각화하는 웹 애플리케이션입니다. 네트워크 인터페이스에서 캡처한 패킷을 서브넷 단위로 집계하여, 중앙 허브(Hub)를 중심으로 한 별(Star) 형태의 인터랙티브 그래프로 표현합니다.

### 주요 기능

- **실시간 트래픽 시각화**: 1초 간격 WebSocket 스냅샷으로 Star 그래프 업데이트
- **다중 집계 윈도우**: 1분 / 5분 / 15분 / 1시간 단위 슬라이딩 윈도우
- **서브넷 레벨 전환**: /8, /16, /24 단위로 트래픽 집계 수준 변경
- **필터링**: 포트, 프로토콜(TCP/UDP/ICMP) 기반 실시간 필터
- **알람 효과**: PPS(Packets Per Second) 기반 Heartbeat/Wave 시각 효과
- **분산 모니터링**: 원격 에이전트를 등록하여 여러 서버의 트래픽을 개별 뷰로 전환
- **시각화 설정**: 노드 크기, 링크 두께, 글로우, 리플, 클러스터, 포스 등 15개 파라미터 실시간 조정
- **다크/라이트 테마**: OS 설정 연동 및 수동 토글
- **시뮬레이션 모드**: libpcap 없이도 가상 트래픽으로 즉시 체험 가능

### 시스템 요구사항

| 항목 | 요구사항 |
|------|----------|
| Node.js | 20.0.0 이상 |
| 브라우저 | Chrome, Firefox, Safari, Edge (ES Modules 지원) |
| 라이브 캡처 | libpcap-dev (Linux) / libpcap (macOS), root/sudo 권한 |
| OS | Linux, macOS, Windows (시뮬레이션 모드) |

---

## 2. 설치 및 시작

### 설치 스크립트 (권장)

설치 스크립트를 사용하면 환경 검증, 시스템 패키지, npm 설치, 설정 파일 생성까지 한 번에 처리됩니다.

```bash
git clone https://github.com/ghkim919/ip-stargaze.git
cd ip-stargaze
bash install.sh
```

스크립트 실행 시 설치 모드를 선택합니다:
- **1) Main Server** — 중앙 모니터링 서버 (포트 15118)
- **2) Agent** — 원격 트래픽 수집 에이전트 (포트 15119)
- **3) Both** — 같은 머신에 서버 + 에이전트 모두 설치

CLI 옵션으로 비대화형 설치도 가능합니다:

```bash
bash install.sh --mode=server --non-interactive    # 서버 자동 설치
bash install.sh --mode=agent --non-interactive     # 에이전트 자동 설치
bash install.sh --help                             # 전체 옵션 보기
```

### 수동 설치

설치 스크립트 없이 직접 설치하려면 아래 단계를 따릅니다.

#### 사전 준비

Node.js 20 이상이 설치되어 있어야 합니다.

```bash
node --version  # v20.0.0 이상 확인
```

라이브 캡처 모드를 사용하려면 libpcap 개발 라이브러리가 필요합니다.

```bash
# Ubuntu/Debian
sudo apt-get install libpcap-dev python3 build-essential

# macOS (Xcode Command Line Tools)
xcode-select --install
```

#### 설치

```bash
git clone https://github.com/ghkim919/ip-stargaze.git
cd ip-stargaze
npm install
```

### 빠른 시작 (시뮬레이션 모드)

libpcap 없이 가상 트래픽으로 즉시 시작할 수 있습니다.

```bash
npm run dev
```

브라우저에서 `http://localhost:15118` 접속 후 Star 그래프가 나타나면 정상 동작입니다.

개발 모드(`npm run dev`)는 `node --watch`를 사용하여 소스 변경 시 자동 재시작합니다.
프로덕션 실행은 `npm start`를 사용합니다.

### 라이브 캡처 모드

실제 네트워크 인터페이스에서 패킷을 캡처합니다. root 권한이 필요합니다.

```bash
sudo MODE=capture INTERFACE=en0 node src/server/index.js
```

`INTERFACE` 값은 시스템의 네트워크 인터페이스 이름으로 변경하세요 (`ip a` 또는 `ifconfig`로 확인).

### .env 파일 활용

프로젝트 루트의 `.env.example` 파일을 복사하여 환경변수를 설정할 수 있습니다.

```bash
cp .env.example .env
```

`.env.example` 내용:

```
MODE=simulation
PORT=15118
INTERFACE=eth0
EVENTS_PER_SECOND=10
```

필요에 따라 값을 수정한 후 서버를 시작하면 환경변수가 자동 적용됩니다.

---

## 3. 화면 구성

### 전체 레이아웃

```
+------------------------------------------------------------------+
|  IP Stargaze   [SIMULATION]   [ 컨트롤 바 (4개 그룹) ]           |
+------------------------------------------------------------------+
|  [Local] [Agent-1] [Agent-2] [+]           (소스 탭 바)          |
+------------------------------------------------------------------+
|  Packets | Unique IPs | PPS | Traffic      (통계 카드 4개)       |
+------------------------------------------------------------------+
|  Last 5 min | 12 subnets | Top: ... | TCP/UDP/ICMP  (정보 바)   |
+------------------------------------------------------------------+
|                                                    +------------+|
|                                                    | Settings   ||
|              Star Graph                            | Panel      ||
|              (SVG 캔버스)                           +------------+|
|                                                    +------------+|
|                                                    | Agent      ||
|                                                    | Panel      ||
|                                                    +------------+|
|                                                    +------------+|
|                                                    | Detail     ||
|                                                    | Panel      ||
|                                                    +------------+|
+------------------------------------------------------------------+
```

### 구성 요소 설명

| 영역 | 설명 |
|------|------|
| **컨트롤 바** | 상단 헤더. View / Filter / Simulation / System 4개 그룹 |
| **모드 배지** | 현재 모드 표시: `SIMULATION`, `LIVE`, `REMOTE` |
| **소스 탭 바** | Local + 등록된 에이전트 탭. 클릭으로 소스 전환 |
| **통계 카드** | Packets, Unique IPs, PPS, Traffic 4개 카드 (호버 툴팁) |
| **정보 바** | 윈도우 배지, 서브넷 수, Top 3 서브넷, 프로토콜 분포 미니바 |
| **Star 그래프** | 메인 시각화 영역. SVG 기반 D3.js Force 레이아웃 |
| **설정 패널** | 우측 슬라이드 패널. 기어 아이콘으로 열기/닫기 |
| **에이전트 패널** | 우측 오버레이. Agents 버튼으로 열기/닫기 |
| **상세 패널** | 우측 오버레이. 노드 클릭 시 서브넷 상세 정보 표시 |
| **연결 상태** | 우하단. WebSocket 연결 상태 (Connected / Reconnecting / Disconnected) |

---

## 4. 컨트롤 바 사용법

컨트롤 바는 4개 그룹으로 나뉘며, 세로 구분선으로 시각적 분리됩니다.

### View 그룹

| 컨트롤 | 설명 | 옵션/범위 | 기본값 |
|--------|------|-----------|--------|
| **Window** | 집계 시간 윈도우 | `1 min`, `5 min`, `15 min`, `1 hour` | `5 min` |
| **Subnet** | 서브넷 집계 단위 | `/8`, `/16`, `/24` | `/16` |
| **Alert** | PPS 알람 임계값 | 1 ~ 100 | 10 |
| **Nodes** | 최대 표시 서브넷 수 | 5 ~ 200 (step 5) | 30 |

- **Window**: 드롭다운으로 시간 윈도우를 변경합니다. 윈도우 밖의 오래된 이벤트는 자동 제거됩니다.
- **Subnet**: /8 (대역 단위), /16 (기관 단위), /24 (소규모 네트워크) 세분화 수준을 버튼으로 전환합니다.
- **Alert**: 입력한 PPS 값 이상의 노드에 Heartbeat/Wave 알람 효과가 적용됩니다.
- **Nodes**: 표시 가능한 최대 서브넷 노드 수. 초과 서브넷은 "Others" 노드로 합쳐집니다.

### Filter 그룹

| 컨트롤 | 설명 |
|--------|------|
| **Port** | 포트 필터 드롭다운. 프리셋(FTP, SSH, HTTP, HTTPS 등 16종) + 커스텀 포트 추가 |
| **Proto** | TCP / UDP / ICMP 프로토콜 토글 버튼. 활성화된 프로토콜만 표시 |
| **Reset** | 모든 필터 초기화 (All Ports, All Protocols) |

포트 프리셋 목록: 21(FTP), 22(SSH), 25(SMTP), 53(DNS), 80(HTTP), 110(POP3), 143(IMAP), 443(HTTPS), 993(IMAPS), 995(POP3S), 3306(MySQL), 3389(RDP), 5432(PostgreSQL), 6379(Redis), 8080(HTTP-Alt), 27017(MongoDB)

커스텀 포트는 1 ~ 65535 범위에서 추가 가능합니다.

### Simulation 그룹

| 컨트롤 | 설명 | 옵션/범위 | 기본값 |
|--------|------|-----------|--------|
| **Scenario** | 시뮬레이션 시나리오 | `Normal`, `Attack`, `Scan` | `Normal` |
| **EPS** | 초당 이벤트 생성 수 | 1 ~ 500 (UI), 1 ~ 1000 (서버 검증) | 10 |

> 라이브 캡처 모드(`LIVE`)이거나 리모트 소스(`REMOTE`) 선택 시 Simulation 그룹이 흐려지고 비활성화됩니다.

### System 그룹

| 컨트롤 | 설명 |
|--------|------|
| **NIC** | 네트워크 인터페이스 선택 (라이브 모드에서만 활성) |
| **Settings** (기어 아이콘) | 시각화 설정 패널 토글 |
| **Agents** | 에이전트 관리 패널 토글 |
| **테마 토글** (해/달 아이콘) | 다크/라이트 테마 전환 |
| **연결 상태** | WebSocket 연결 상태 표시 (녹색 점: Connected, 노란색 점: Reconnecting, 회색 점: Disconnected) |

---

## 5. Star 그래프 상호작용

### 노드 읽기

Star 그래프의 각 요소는 다음 정보를 나타냅니다.

| 요소 | 의미 |
|------|------|
| **중앙 허브 (Hub)** | 모니터링 중인 서버. 총 패킷 수와 인터페이스 이름 표시 |
| **서브넷 노드** | 개별 서브넷. 원의 크기가 트래픽 양에 비례 |
| **노드 색상** | 서브넷 고유 색상. 다크 테마에서는 hue 210(파란 계열), 라이트 테마에서는 hue 155(녹색 계열) 기반 |
| **노드 라벨** | 서브넷 CIDR 주소 (예: `192.168.0.0/16`) |
| **링크** | 허브와 서브넷 간 연결선. 두께가 트래픽 양에 비례 |
| **링크 라벨** | 패킷 수 / PPS 수치 표시 |
| **클러스터** | 같은 상위 서브넷(/8)에 속하는 노드들의 그룹. 반투명 Hull 영역으로 시각화 |
| **클러스터 라벨** | 클러스터 상위 서브넷 이름 (Hull 상단에 표시) |

### 인터랙션

| 동작 | 효과 |
|------|------|
| **마우스 휠** | 줌 인/아웃 (0.1x ~ 4x) |
| **드래그 (빈 공간)** | 캔버스 팬(이동) |
| **드래그 (노드)** | 노드를 수동으로 이동. 드래그 종료 후 물리 시뮬레이션으로 복귀 |
| **노드 클릭** | 해당 노드를 하이라이트하고 상세 패널 열기 |
| **다시 클릭 / 빈 공간 클릭** | 하이라이트 해제 |
| **호버** | 노드 위에 마우스를 올리면 툴팁 표시 |

### 하이라이트

노드를 클릭하면 선택된 노드와 직접 연결된 링크가 강조됩니다. 나머지 노드/링크/라벨/클러스터는 흐려집니다.

- 선택 노드 확대 비율: HIGHLIGHT_SCALE (기본 1.3x)
- 비선택 노드 투명도: 0.15
- 비선택 링크 투명도: 0.05
- 선택 링크 투명도: 0.9

### 알람 효과

PPS가 Alert 임계값(기본 10) 이상인 노드에 시각 효과가 적용됩니다.

| 레벨 | 조건 | 효과 |
|------|------|------|
| **HIGH** | PPS >= 임계값 | Heartbeat(이중 박동) + Wave(3-ring burst) + 핑크-레드 글로우 |
| **MID** | PPS >= 임계값 x 0.5 | 중간 글로우 + 리플 |
| **LOW** | PPS >= 임계값 x 0.2 | 약한 글로우 + 느린 리플 |
| **NONE** | PPS < 임계값 x 0.2 | 미약한 글로우만 |

- **Heartbeat**: 800ms 주기 이중 박동 애니메이션 (scale 1 -> 1.15 -> 0.97 -> 1.08 -> 1)
- **Wave**: 핑크-레드(#c24873) 3-ring burst, 250ms 간격, 80px 확산, 1200ms 지속
- 알람 시에도 노드의 채우기(fill) 색상은 서브넷 고유 색상을 유지합니다. 글로우와 테두리만 알람 색상으로 변경됩니다.

### 상세 패널

노드를 클릭하면 우측에 상세 패널이 열립니다.

표시 정보:
- 서브넷 CIDR 주소 및 고유 색상 바
- Private/Public 네트워크 구분 배지
- Packets, Unique IPs, PPS, Bytes 통계
- 프로토콜 분포 바 (TCP/UDP/ICMP 비율)
- 프로토콜 상세 카드 (포트별 분류)
- IP 목록 (초기: Top IPs, 서버 응답 후: All IPs)

---

## 6. 시각화 설정 패널

System 그룹의 기어 아이콘을 클릭하면 우측에서 설정 패널이 슬라이드됩니다.

7개 그룹, 15개 설정 항목을 실시간으로 조정할 수 있으며, 변경 사항은 localStorage에 자동 저장됩니다.

### Node 그룹

| 설정 | 타입 | 범위 | 기본값 | 설명 |
|------|------|------|--------|------|
| Min Radius | range | 4 ~ 50 (step 1) | 12px | 트래픽이 적은 서브넷의 최소 원 크기 |
| Max Radius | range | 20 ~ 120 (step 2) | 50px | 트래픽이 많은 서브넷의 최대 원 크기 |
| Highlight Scale | range | 1.0 ~ 3.0 (step 0.1) | 1.3x | 선택된 노드의 확대 배율 |

### Link 그룹

| 설정 | 타입 | 범위 | 기본값 | 설명 |
|------|------|------|--------|------|
| Min Width | range | 0.5 ~ 10 (step 0.5) | 2px | 트래픽이 적은 연결의 최소 선 두께 |
| Max Width | range | 2 ~ 20 (step 0.5) | 4px | 트래픽이 많은 연결의 최대 선 두께 |
| Opacity | range | 0.1 ~ 1.0 (step 0.05) | 0.5 | 링크 선의 기본 투명도 |

### Label 그룹

| 설정 | 타입 | 범위 | 기본값 | 설명 |
|------|------|------|--------|------|
| Font Size | range | 8 ~ 28 (step 1) | 11px | 서브넷 라벨의 텍스트 크기 |

### Glow 그룹

| 설정 | 타입 | 범위 | 기본값 | 설명 |
|------|------|------|--------|------|
| Enabled | toggle | on/off | on | 활성 노드 주변 글로우 효과 토글 |
| High Opacity | range | 0.1 ~ 1.0 (step 0.05) | 0.6 | 고트래픽 노드의 글로우 밝기 |

### Ripple 그룹

| 설정 | 타입 | 범위 | 기본값 | 설명 |
|------|------|------|--------|------|
| Enabled | toggle | on/off | on | 활성 노드의 리플 애니메이션 토글 |

### Cluster 그룹

| 설정 | 타입 | 범위 | 기본값 | 설명 |
|------|------|------|--------|------|
| Hull Visible | toggle | on/off | on | 클러스터 Convex Hull 경계선 표시/숨기기 |
| Hull Padding | range | 5 ~ 80 (step 1) | 18px | 노드와 Hull 경계 사이의 여백 |
| Label Size | range | 6 ~ 24 (step 1) | 10px | 클러스터 이름 라벨의 텍스트 크기 |

### Force 그룹

| 설정 | 타입 | 범위 | 기본값 | 설명 |
|------|------|------|--------|------|
| Charge | range | -800 ~ -20 (step 10) | -180 | 노드 간 반발력 (음수가 클수록 강함) |
| Link Dist | range | 80 ~ 600 (step 10) | 160px | 허브-노드 간 목표 거리 |
| Cluster Dist | range | 120 ~ 700 (step 10) | 250px | 클러스터 피어 간 목표 거리 |

> Force 그룹의 설정은 슬라이더 드래그 중에는 반영되지 않고, 드래그를 놓은 시점(`change` 이벤트)에 시뮬레이션이 재시작됩니다.

### MIN/MAX 교차 검증

- Min Radius와 Max Radius: Min > Max가 되지 않도록 자동 보정
- Min Width와 Max Width: Min > Max가 되지 않도록 자동 보정

### Reset All

패널 하단의 `Reset All` 버튼을 누르면 모든 설정이 기본값으로 복원되고, localStorage 저장 데이터가 삭제됩니다.

### 영속화

변경된 설정은 브라우저의 localStorage에 `ip-stargaze-visual-settings` 키로 저장됩니다. 기본값과 다른 항목만 delta 형태로 저장되므로 용량이 최소화됩니다.

---

## 7. 서버 설정 가이드

### 환경변수

서버는 환경변수 또는 `.env` 파일로 설정합니다.

| 환경변수 | 설명 | 기본값 |
|----------|------|--------|
| `MODE` | 동작 모드 (`simulation` 또는 `capture`) | `simulation` |
| `PORT` | HTTP/WebSocket 서버 포트 | `15118` |
| `HOST` | 바인딩 호스트 | `0.0.0.0` |
| `INTERFACE` | 캡처할 네트워크 인터페이스 | `eth0` |
| `EVENTS_PER_SECOND` | 시뮬레이션 모드 초당 이벤트 수 (최소 1) | `10` |

### 분산 모니터링 서버 설정

| 환경변수 | 설명 | 기본값 |
|----------|------|--------|
| `AGENTS_FILE` | 에이전트 정보 저장 파일 경로 | `./agents.json` |
| `POLLING_INTERVAL` | 에이전트 폴링 주기 (ms) | `2000` |
| `POLLING_TIMEOUT` | 에이전트 폴링 타임아웃 (ms) | `5000` |
| `MAX_EVENTS_PER_POLL` | 폴링당 최대 이벤트 수 | `10000` |

### 서버 내부 상수 (코드 수정 필요)

| 상수 | 값 | 설명 |
|------|----|------|
| `maxAgents` | 20 | 최대 등록 가능 에이전트 수 |
| `defaultWindow` | `5m` | 기본 집계 윈도우 |
| `defaultSubnetLevel` | `/16` | 기본 서브넷 레벨 |
| `defaultScenario` | `normal` | 기본 시뮬레이션 시나리오 |
| `snapshotIntervalMs` | 1000 | 스냅샷 브로드캐스트 간격 (ms) |
| `maxSubnetsInSnapshot` | 30 | 스냅샷 내 최대 서브넷 수 |

### 유효 값

| 항목 | 유효 값 |
|------|---------|
| Window | `1m`, `5m`, `15m`, `1h` |
| Subnet Level | `/8`, `/16`, `/24` |
| Scenario | `normal`, `attack`, `scan` |
| EPS | 1 ~ 1000 |
| Port | 1 ~ 65535 |
| Protocol | `TCP`, `UDP`, `ICMP` |

---

## 8. 분산 모니터링 설정

### 아키텍처 개요

```
                     +---------------------+
                     |   중앙 서버 (:15118) |
                     |                     |
                     |  +-- Aggregator(L) --+-- WebSocket --> 브라우저
                     |  |                  |
                     |  +-- RemoteCollector |
                     |      |    |    |    |
                     +------+----+----+----+
                            |    |    |
                    polling  |    |    |  polling
                            v    v    v
                     +------+ +------+ +------+
                     |Agent1| |Agent2| |Agent3|
                     |:15119| |:15119| |:15119|
                     +------+ +------+ +------+

  * 각 에이전트에 독립 Aggregator가 할당됨
  * 소스 탭으로 Local/Remote 전환 (개별 뷰 방식)
```

- **중앙 서버**: 로컬 캡처 + 원격 에이전트 폴링. 클라이언트별 선택된 소스에 따라 해당 Aggregator의 스냅샷을 전송합니다.
- **에이전트**: 원격 서버에서 패킷을 캡처하고 Ring Buffer에 보관. REST API로 이벤트를 제공합니다.
- **RemoteCollector**: 등록된 에이전트를 주기적으로 폴링하고, 에이전트별 독립 Aggregator에 이벤트를 전달합니다.

### 에이전트 설치 및 실행

에이전트는 IP Stargaze와 같은 코드베이스를 사용합니다.

```bash
# 원격 서버에서
git clone https://github.com/ghkim919/ip-stargaze.git
cd ip-stargaze
npm install
```

#### 에이전트 환경변수

| 환경변수 | 설명 | 기본값 |
|----------|------|--------|
| `AGENT_ID` | 에이전트 고유 식별자 | `os.hostname()` |
| `AGENT_PORT` | 에이전트 HTTP 포트 | `15119` |
| `AGENT_HOST` | 바인딩 호스트 | `0.0.0.0` |
| `AGENT_MODE` | 동작 모드 (`simulation` / `capture`) | `simulation` |
| `AGENT_INTERFACE` | 캡처할 네트워크 인터페이스 | `eth0` |
| `AGENT_API_KEY` | Bearer 토큰 인증 키 (형식 제한 없음, 자유롭게 지정) | (빈 문자열 - 인증 비활성) |
| `AGENT_BUFFER_CAPACITY` | Ring Buffer 최대 이벤트 수 | `100000` |
| `AGENT_LOG_LEVEL` | 로그 레벨 (`info` / `debug`) | `info` |

#### agent.config.json 파일

환경변수 외에 `agent.config.json` 파일로도 설정할 수 있습니다. 우선순위: 환경변수 > agent.config.json > 기본값

```json
{
  "agentId": "web-server-01",
  "port": 15119,
  "host": "0.0.0.0",
  "mode": "simulation",
  "interface": "eth0",
  "apiKey": "your-api-key-here",
  "bufferCapacity": 100000,
  "logLevel": "info"
}
```

프로젝트 루트의 `agent.config.json.example`을 참고하세요.

#### 에이전트 시작

```bash
# 시뮬레이션 모드
npm run start:agent

# 라이브 캡처 모드
sudo AGENT_MODE=capture AGENT_INTERFACE=eth0 AGENT_API_KEY=my-secret-key node src/agent/index.js

# 개발 모드 (--watch)
npm run dev:agent
```

### 에이전트 등록

#### UI를 통한 등록

1. 컨트롤 바의 **Agents** 버튼을 클릭하여 에이전트 패널 열기
2. **+ Add Agent** 버튼 클릭
3. 폼에 정보 입력:
   - **URL**: 에이전트 주소 (예: `http://10.0.1.5:15119`)
   - **API Key**: 에이전트에 설정한 Bearer 토큰
   - **Label**: 표시 이름 (선택사항)
4. **Test** 버튼으로 연결 테스트
5. **Add** 버튼으로 등록

또는 소스 탭 바의 **[+]** 버튼을 클릭해도 에이전트 패널이 열립니다.

#### agents.json 직접 편집

서버의 `agents.json` 파일(경로: `AGENTS_FILE` 환경변수)을 직접 편집할 수 있습니다.

```json
{
  "agents": [
    {
      "id": "web-server-01",
      "url": "http://10.0.1.5:15119",
      "apiKey": "my-secret-key",
      "label": "Web Server",
      "enabled": true
    }
  ]
}
```

> 서버 재시작 시 자동으로 파일을 로드합니다.

### 소스 전환

소스 탭 바에서 탭을 클릭하면 해당 소스의 트래픽 데이터로 전환됩니다.

- **Local**: 중앙 서버의 로컬 트래픽
- **에이전트 탭**: 해당 에이전트의 원격 트래픽

전환 시 모드 배지가 `REMOTE`로 변경되고, Simulation/NIC 컨트롤이 비활성화됩니다. Window, Subnet, Filter, MaxNodes 설정은 소스별로 독립 적용됩니다.

### 에이전트 상태

각 에이전트 탭에는 상태를 나타내는 점(dot)이 표시됩니다.

| 상태 | 색상 | 조건 |
|------|------|------|
| **online** | 녹색 | 최근 3회 폴링 모두 성공 |
| **degraded** | 노란색 | 최근 3회 폴링 중 일부 실패 |
| **offline** | 회색 | 최근 3회 폴링 모두 실패 |

폴링 실패 시 지수적 백오프가 적용됩니다 (2초 ~ 최대 30초).

### Clock Sync

원격 에이전트와 중앙 서버 간 시계 차이를 RTT(Round-Trip Time) 기반으로 보정합니다.

- 알고리즘: EMA(Exponential Moving Average), alpha = 0.2
- 보정된 타임스탬프로 이벤트가 올바른 시간 윈도우에 배치됩니다.
- 시계 차이가 30초 이상이면 경고 로그가 출력됩니다.

### 보안 고려사항

- **API Key**: 에이전트에 반드시 `AGENT_API_KEY`를 설정하세요. 형식 제한은 없으며 원하는 문자열을 자유롭게 지정하면 됩니다. 미설정 시 모든 엔드포인트가 인증 없이 노출됩니다.
- **방화벽**: 에이전트 포트(기본 15119)는 중앙 서버에서만 접근 가능하도록 방화벽을 설정하세요.
- **agents.json 보호**: API Key가 평문으로 저장되므로, 파일 권한을 적절히 설정하세요 (`chmod 600 agents.json`).
- **HTTPS**: 프로덕션 환경에서는 리버스 프록시(Nginx 등)로 HTTPS를 적용하는 것을 권장합니다.

### 에이전트 REST API 레퍼런스

#### GET /api/health

헬스 체크 엔드포인트. 인증 불필요.

응답 예시:
```json
{
  "status": "ok",
  "agentId": "web-server-01",
  "uptime": 3600,
  "mode": "simulation",
  "interface": "eth0",
  "bufferSize": 5000,
  "bufferCapacity": 100000,
  "captureActive": true,
  "version": "0.1.0",
  "timestamp": 1708300000000
}
```

#### GET /api/events?since=&limit=

이벤트 조회. **Bearer 토큰 인증 필수** (API Key 설정 시).

| 파라미터 | 설명 | 기본값 |
|----------|------|--------|
| `since` | 이 seq 이후의 이벤트 반환 | (없으면 전체) |
| `limit` | 최대 반환 이벤트 수 | 10000 (최대 50000) |

요청 헤더:
```
Authorization: Bearer <API_KEY>
```

응답 예시:
```json
{
  "agentId": "web-server-01",
  "sequenceStart": 101,
  "sequenceEnd": 200,
  "events": [...],
  "hasMore": false,
  "gapDetected": false,
  "serverTimestamp": 1708300000000
}
```

#### GET /api/info

에이전트 정보. **Bearer 토큰 인증 필수** (API Key 설정 시).

응답 예시:
```json
{
  "agentId": "web-server-01",
  "hostname": "web-server-01",
  "version": "0.1.0",
  "mode": "simulation",
  "interface": "eth0",
  "supportedFeatures": ["events", "health"],
  "timestamp": 1708300000000
}
```

---

## 9. Docker 사용법

### docker-compose.yml 구성

프로젝트에 포함된 `docker-compose.yml`은 3개의 서비스를 정의합니다.

| 서비스 | 역할 | 포트 |
|--------|------|------|
| `server` | 중앙 서버 (시뮬레이션 모드) | 15118 (호스트에 노출) |
| `agent-web` | 에이전트 1 (웹 서버 시뮬레이션) | 15119 (내부) |
| `agent-db` | 에이전트 2 (DB 서버 시뮬레이션) | 15119 (내부) |

에이전트 정보:
- `agent-web`: ID `web-server-01`, API Key `test-key-web`
- `agent-db`: ID `db-server-01`, API Key `test-key-db`

### 실행

```bash
docker compose up --build
```

### 접속

브라우저에서 `http://localhost:15118` 접속.

### 에이전트 등록

Docker 네트워크 내에서 에이전트에 접근하려면 서비스 이름을 URL로 사용합니다.

1. Agents 패널 열기
2. 에이전트 추가:
   - agent-web: URL `http://agent-web:15119`, API Key `test-key-web`
   - agent-db: URL `http://agent-db:15119`, API Key `test-key-db`

### 중지

```bash
docker compose down
```

볼륨(`agent-data`)에 `agents.json`이 저장되므로, 재시작해도 등록 정보가 유지됩니다.

### Dockerfile 참고

```dockerfile
FROM node:20-slim
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 build-essential libpcap-dev && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
COPY agent.config.json.example ./
EXPOSE 15118 15119
```

> `python3`, `build-essential`, `libpcap-dev`는 `cap` 네이티브 모듈 빌드에 필요합니다.

---

## 10. 개발자 가이드

### 프로젝트 구조

```
ip-stargaze/
├── src/
│   ├── server/                    # 중앙 서버
│   │   ├── index.js               # 서버 엔트리포인트
│   │   ├── config.js              # 서버 설정 (환경변수)
│   │   ├── config/
│   │   │   └── constants.js       # 공유 상수 (WINDOW_DURATIONS, VALIDATION_RULES, AGGREGATOR_DEFAULTS, PORT_LABELS)
│   │   ├── capture/
│   │   │   ├── captureManager.js  # 캡처 관리 (simulator/pcap 선택)
│   │   │   ├── simulator.js       # 시뮬레이션 패킷 생성기
│   │   │   └── pcapEngine.js      # libpcap 캡처 엔진
│   │   ├── analysis/
│   │   │   ├── aggregator.js      # 이벤트 집계, 스냅샷 생성
│   │   │   └── ipClassifier.js    # IP 주소 분류 (private/public, label)
│   │   ├── ws/
│   │   │   ├── wsHandler.js       # WebSocket 핸들러 (소스 라우팅)
│   │   │   └── messageValidator.js # 메시지 유효성 검증
│   │   └── remote/
│   │       ├── remoteCollector.js  # 에이전트 폴링 오케스트레이터
│   │       ├── agentConnection.js  # 개별 에이전트 연결/폴링
│   │       ├── agentStore.js       # 에이전트 CRUD + JSON 영속화
│   │       └── clockSync.js        # RTT 기반 시계 보정
│   │
│   ├── agent/                     # 원격 에이전트
│   │   ├── index.js               # 에이전트 엔트리포인트
│   │   ├── agentConfig.js         # 에이전트 설정 (환경변수 > json > 기본값)
│   │   ├── eventBuffer.js         # Ring Buffer (monotonic seq)
│   │   └── routes.js              # REST API 엔드포인트
│   │
│   ├── client/                    # 프론트엔드 (Vanilla JS)
│   │   ├── index.html             # HTML 엔트리
│   │   ├── css/style.css          # 전체 스타일시트
│   │   └── js/
│   │       ├── app.js             # 앱 초기화, WebSocket 관리, 컨트롤 이벤트
│   │       ├── starGraph.js       # Star 그래프 메인 모듈
│   │       ├── dashboard.js       # 통계 카드 + 정보 바 업데이트
│   │       ├── detailPanel.js     # 서브넷 상세 패널
│   │       ├── agentPanel.js      # 에이전트 관리 패널
│   │       ├── sourceTabBar.js    # 소스 탭 바
│   │       ├── settingsPanel.js   # 시각화 설정 패널
│   │       ├── config.js          # VISUAL_CONFIG, PPS_THRESHOLDS, WEBSOCKET_CONFIG
│   │       ├── utils.js           # 유틸리티 (formatNumber, getSubnetColor 등)
│   │       ├── helpers/           # themeHelpers, modeHelpers, highlightManager
│   │       ├── rendering/         # hubRenderer, nodeRenderer, linkRenderer, labelRenderer, clusterRenderer
│   │       ├── effects/           # rippleEffect, glowFilters
│   │       ├── interaction/       # tooltipManager, dragBehavior
│   │       ├── layout/            # positionManager, zoomManager
│   │       ├── simulation/        # forceSimulation
│   │       └── data/              # graphDataManager
│   │
│   └── shared/
│       └── protocol.js            # WebSocket 메시지 타입 상수 (MSG, ERR)
│
├── test/                          # 테스트 (vitest)
│   ├── aggregator.test.js
│   ├── ipClassifier.test.js
│   ├── simulator.test.js
│   ├── eventBuffer.test.js
│   ├── clockSync.test.js
│   ├── agentStore.test.js
│   └── remoteCollector.test.js
│
├── docs/                          # 문서
│   ├── SPEC.md
│   ├── SPEC-distributed.md
│   └── USER-MANUAL.md
│
├── docker-compose.yml
├── Dockerfile
├── package.json
├── .env.example
└── agent.config.json.example
```

### 데이터 흐름

#### 로컬 데이터 흐름

```
CaptureManager (simulator/pcap)
  --> packet event
    --> Aggregator.addEvent()
      --> 슬라이딩 윈도우 저장
        --> startPeriodicSnapshot() [1초 간격]
          --> Aggregator.buildSnapshot()
            --> WsHandler.broadcastSnapshots()
              --> 각 클라이언트에 JSON 전송
```

#### 분산 데이터 흐름

```
원격 에이전트:
  CaptureManager --> EventBuffer.push()
    --> REST API /api/events (폴링 대기)

중앙 서버:
  RemoteCollector [2초 간격 폴링]
    --> AgentConnection.poll()
      --> /api/events?since=N&limit=10000
        --> ClockSync.adjustTimestamp()
          --> Aggregator(에이전트별).addEvent()

  WsHandler.broadcastSnapshots()
    --> 클라이언트별 selectedSource 확인
      --> 해당 Aggregator.buildSnapshot() 전송
```

### WebSocket 프로토콜

모든 메시지는 JSON 형식입니다: `{ type: string, value?: any, data?: any }`

#### 클라이언트 -> 서버 (C->S)

| 메시지 타입 | value 형식 | 설명 |
|-------------|-----------|------|
| `setWindow` | `"1m"` / `"5m"` / `"15m"` / `"1h"` | 집계 윈도우 변경 |
| `setSubnetLevel` | `"/8"` / `"/16"` / `"/24"` | 서브넷 레벨 변경 |
| `setMaxNodes` | `5` ~ `200` (정수) | 최대 노드 수 변경 |
| `setScenario` | `"normal"` / `"attack"` / `"scan"` | 시뮬레이션 시나리오 변경 |
| `setEventsPerSecond` | `"1"` ~ `"1000"` (문자열) | EPS 변경 |
| `setFilter` | `{ ports: number[], protocols: string[] }` | 필터 설정 |
| `setInterface` | `"eth0"` (인터페이스명) | NIC 변경 (라이브 모드만) |
| `getInterfaces` | - | 사용 가능한 NIC 목록 요청 |
| `setSource` | `"local"` / 에이전트 ID | 소스 전환 |
| `getSubnetDetail` | `"192.168.0.0/16"` (서브넷 CIDR) | 서브넷 상세 정보 요청 |
| `addAgent` | `{ url, apiKey, label }` | 에이전트 등록 |
| `removeAgent` | `{ id }` | 에이전트 삭제 |
| `setAgentEnabled` | `{ id, enabled }` | 에이전트 활성/비활성 |
| `testAgent` | `{ url, apiKey }` | 에이전트 연결 테스트 |
| `getAgents` | - | 에이전트 목록 요청 |

#### 서버 -> 클라이언트 (S->C)

| 메시지 타입 | data 형식 | 설명 |
|-------------|----------|------|
| `snapshot` | 스냅샷 객체 (summary, subnets[], window) | 1초 간격 트래픽 스냅샷 |
| `config` | 설정 객체 (mode, window, subnetLevel, ...) | 현재 서버 설정 |
| `interfaces` | `[{ name, address }]` | NIC 목록 |
| `subnetDetail` | 서브넷 상세 객체 (allIps, protocolDetail, ...) | 서브넷 상세 정보 |
| `agents` | `[{ id, url, label, enabled, status }]` | 에이전트 목록 |
| `testAgentResult` | `{ success, agentId?, error? }` | 에이전트 테스트 결과 |
| `error` | `{ message }` | 에러 메시지 |

### 테스트

vitest 기반 테스트 스위트를 실행합니다.

```bash
# 전체 테스트 실행
npm test

# 감시 모드 (변경 시 자동 재실행)
npm run test:watch
```

테스트 파일: 7개 파일

| 파일 | 대상 |
|------|------|
| `aggregator.test.js` | 이벤트 집계, 스냅샷 빌드, 필터, 윈도우 |
| `ipClassifier.test.js` | IP 주소 분류 (private/public, 라벨) |
| `simulator.test.js` | 시뮬레이션 패킷 생성 |
| `eventBuffer.test.js` | Ring Buffer push/getSince/getAll |
| `clockSync.test.js` | RTT 기반 시계 보정 |
| `agentStore.test.js` | 에이전트 CRUD + JSON 영속화 |
| `remoteCollector.test.js` | 에이전트 폴링, Aggregator 관리 |

### 확장 포인트

#### 새 시뮬레이션 시나리오 추가

1. `src/server/config.js`의 `validScenarios` 배열에 새 시나리오명 추가
2. `src/server/capture/simulator.js`에 시나리오별 패킷 생성 로직 추가
3. `src/client/index.html`의 `#scenario-select`에 `<option>` 추가

#### 새 WebSocket 메시지 추가

1. `src/shared/protocol.js`의 `MSG` 객체에 메시지 타입 상수 추가
2. `src/server/ws/messageValidator.js`에 유효성 검증 함수 추가
3. `src/server/ws/wsHandler.js`의 `#handleMessage` switch에 case 추가
4. `src/client/js/app.js`의 `handleMessage` switch에 case 추가

#### 새 시각화 설정 항목 추가

1. `src/client/js/config.js`의 `V` 객체에 새 상수 추가
2. `src/client/js/settingsPanel.js`의 `DEFAULTS` 객체에 기본값 추가
3. `settingsPanel.js`의 `SETTING_GROUPS` 배열의 적절한 그룹에 설정 항목 추가
4. 필요시 `MIN_MAX_PAIRS` 또는 `FORCE_KEYS`에 등록
5. 렌더링 코드에서 `VISUAL_CONFIG.NEW_KEY`로 참조

---

## 11. 문제 해결 (Troubleshooting)

| 증상 | 원인 | 해결 |
|------|------|------|
| `npm install` 실패: cap 빌드 오류 | libpcap 개발 라이브러리 미설치 | `sudo apt-get install libpcap-dev python3 build-essential` (Linux) / `xcode-select --install` (macOS) |
| 서버 시작 후 "Failed to start server" | 포트 15118이 이미 사용 중 | `PORT=3000 npm start`로 다른 포트 사용 |
| 브라우저 접속 시 빈 화면 | WebSocket 연결 실패 | 브라우저 콘솔 확인, 서버가 실행 중인지 확인 |
| 연결 상태 "Disconnected" | WebSocket 연결 끊김 | 서버 실행 상태 확인. 자동 재연결 시도 (최대 5회, 3초 기본 + 1.5x 백오프) |
| Star 그래프에 노드가 없음 | 트래픽 없음 또는 필터가 모든 데이터를 제외 | Reset 버튼으로 필터 초기화, 시뮬레이션 모드에서 EPS 값 확인 |
| 라이브 모드에서 패킷 캡처 안 됨 | root 권한 없음 또는 잘못된 인터페이스 | `sudo`로 실행, `INTERFACE` 환경변수를 올바른 인터페이스로 설정 |
| 에이전트 등록 시 "Unauthorized" | API Key 불일치 | 에이전트의 `AGENT_API_KEY`와 등록 시 입력한 API Key가 동일한지 확인 |
| 에이전트 상태가 "offline" | 네트워크 불통 또는 에이전트 미실행 | 에이전트 프로세스 실행 확인, 방화벽 설정 확인, `curl http://<agent>:15119/api/health`로 테스트 |
| 에이전트 상태가 "degraded" | 간헐적 폴링 실패 | 네트워크 지연 또는 에이전트 부하 확인. 자동 백오프 후 복구 대기 |
| 에이전트 시계 경고 ("Large clock offset") | 서버-에이전트 간 시계 차이 30초 이상 | NTP로 서버 간 시계 동기화 |
| Docker에서 cap 빌드 실패 | 빌드 도구 미설치 | Dockerfile에 `python3 build-essential libpcap-dev` 설치 확인 |
| Docker 에이전트 등록 실패 | 호스트명 대신 서비스명 필요 | Docker 네트워크 내 서비스 이름으로 URL 입력 (예: `http://agent-web:15119`) |
| 설정 패널 변경이 저장 안 됨 | localStorage 비활성 또는 용량 초과 | 브라우저 설정에서 localStorage 확인, 시크릿 모드 아닌지 확인 |
| Force 설정 변경 시 바로 반영 안 됨 | 정상 동작 (드래그 중 떨림 방지) | 슬라이더를 놓으면(change 이벤트) 시뮬레이션 재시작 |
| "Maximum agent limit (20) reached" | 최대 에이전트 수 도달 | 불필요한 에이전트 삭제 후 재시도 |

---

## 12. 용어 사전

| 용어 | 설명 |
|------|------|
| **Star Graph** | 중앙 허브를 중심으로 서브넷 노드가 방사형으로 배치되는 네트워크 시각화 형태 |
| **Hub** | Star 그래프의 중앙 노드. 모니터링 대상 서버를 나타냄 |
| **Node** | 그래프의 개별 서브넷을 나타내는 원(circle) 요소 |
| **Link** | 허브와 노드를 연결하는 선. 트래픽 관계를 나타냄 |
| **Cluster** | 같은 상위 서브넷에 속하는 노드들의 그룹. Convex Hull로 시각화 |
| **Hull** | 클러스터의 경계를 감싸는 반투명 Convex Hull 도형 |
| **CIDR** | Classless Inter-Domain Routing. IP 주소와 서브넷 마스크를 `192.168.0.0/16` 형태로 표기 |
| **PPS** | Packets Per Second. 초당 패킷 수 |
| **EPS** | Events Per Second. 시뮬레이션 모드에서 초당 생성되는 이벤트 수 |
| **Subnet Level** | 서브넷 집계 단위. /8 (256개 그룹), /16 (65,536 그룹), /24 (16,777,216 그룹) |
| **Window** | 슬라이딩 타임 윈도우. 이 기간 동안의 이벤트만 집계 |
| **Snapshot** | 현재 윈도우의 집계 결과를 캡처한 시점 데이터 |
| **Aggregator** | 이벤트를 수집, 집계하여 스냅샷을 생성하는 서버 컴포넌트 |
| **Ring Buffer** | 고정 크기 순환 버퍼. 에이전트에서 이벤트 임시 저장에 사용 |
| **Sequence Number** | Ring Buffer의 단조 증가 이벤트 번호. 폴링 시 `since` 파라미터로 사용 |
| **Heartbeat** | PPS HIGH 알람 시 노드의 이중 박동 애니메이션 |
| **Wave** | PPS HIGH 알람 시 노드에서 확산되는 원형 파동 효과 |
| **Glow** | 노드 주변에 표시되는 발광 효과. SVG filter 기반 |
| **Ripple** | 노드에서 주기적으로 발생하는 물결 애니메이션 |
| **Clock Sync** | RTT 기반으로 원격 에이전트와 중앙 서버 간 시계 차이를 보정하는 메커니즘 |
| **Polling** | 중앙 서버가 에이전트에 주기적으로 이벤트를 요청하는 방식 |
| **Backoff** | 연속 실패 시 폴링 간격을 점진적으로 증가시키는 전략 |
| **Force Layout** | D3.js의 물리 시뮬레이션 기반 그래프 레이아웃 알고리즘 |

---

## 부록 A: 환경변수 전체 레퍼런스

### 중앙 서버 환경변수

| 환경변수 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `MODE` | string | `simulation` | 동작 모드. `simulation` 또는 `capture` |
| `PORT` | number | `15118` | HTTP/WebSocket 서버 포트 |
| `HOST` | string | `0.0.0.0` | 바인딩 호스트 주소 |
| `INTERFACE` | string | `eth0` | 패킷 캡처 네트워크 인터페이스 |
| `EVENTS_PER_SECOND` | number | `10` | 시뮬레이션 모드 초당 이벤트 수 (최소 1) |
| `AGENTS_FILE` | string | `./agents.json` | 에이전트 등록 정보 저장 파일 경로 |
| `POLLING_INTERVAL` | number | `2000` | 에이전트 폴링 주기 (ms) |
| `POLLING_TIMEOUT` | number | `5000` | 에이전트 폴링 HTTP 타임아웃 (ms) |
| `MAX_EVENTS_PER_POLL` | number | `10000` | 폴링당 최대 요청 이벤트 수 |

### 에이전트 환경변수

| 환경변수 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `AGENT_ID` | string | `os.hostname()` | 에이전트 고유 식별자 |
| `AGENT_PORT` | number | `15119` | 에이전트 HTTP 서버 포트 |
| `AGENT_HOST` | string | `0.0.0.0` | 바인딩 호스트 주소 |
| `AGENT_MODE` | string | `simulation` | 동작 모드. `simulation` 또는 `capture` |
| `AGENT_INTERFACE` | string | `eth0` | 패킷 캡처 네트워크 인터페이스 |
| `AGENT_API_KEY` | string | (빈 문자열) | Bearer 토큰 인증 키. 형식 제한 없이 자유롭게 지정. 미설정 시 인증 비활성 |
| `AGENT_BUFFER_CAPACITY` | number | `100000` | Ring Buffer 최대 이벤트 수 |
| `AGENT_LOG_LEVEL` | string | `info` | 로그 레벨 (`info` / `debug`) |

---

## 부록 B: WebSocket 메시지 프로토콜 전체 레퍼런스

`src/shared/protocol.js`에 정의된 메시지 타입 상수입니다.

### MSG (메시지 타입)

| 상수명 | 값 | 방향 | 설명 |
|--------|----|------|------|
| `SET_WINDOW` | `setWindow` | C->S | 집계 윈도우 변경 |
| `SET_SUBNET_LEVEL` | `setSubnetLevel` | C->S | 서브넷 레벨 변경 |
| `SET_SCENARIO` | `setScenario` | C->S | 시뮬레이션 시나리오 변경 |
| `SET_EVENTS_PER_SECOND` | `setEventsPerSecond` | C->S | EPS 변경 |
| `SET_FILTER` | `setFilter` | C->S | 포트/프로토콜 필터 설정 |
| `SET_INTERFACE` | `setInterface` | C->S | NIC 변경 |
| `GET_INTERFACES` | `getInterfaces` | C->S | NIC 목록 요청 |
| `SET_SOURCE` | `setSource` | C->S | 소스(Local/Agent) 전환 |
| `SET_MAX_NODES` | `setMaxNodes` | C->S | 최대 노드 수 변경 |
| `GET_SUBNET_DETAIL` | `getSubnetDetail` | C->S | 서브넷 상세 정보 요청 |
| `ADD_AGENT` | `addAgent` | C->S | 에이전트 등록 |
| `REMOVE_AGENT` | `removeAgent` | C->S | 에이전트 삭제 |
| `SET_AGENT_ENABLED` | `setAgentEnabled` | C->S | 에이전트 활성/비활성 |
| `TEST_AGENT` | `testAgent` | C->S | 에이전트 연결 테스트 |
| `GET_AGENTS` | `getAgents` | C->S | 에이전트 목록 요청 |
| `SNAPSHOT` | `snapshot` | S->C | 트래픽 스냅샷 |
| `CONFIG` | `config` | S->C | 현재 설정 |
| `INTERFACES` | `interfaces` | S->C | NIC 목록 |
| `SUBNET_DETAIL` | `subnetDetail` | S->C | 서브넷 상세 정보 |
| `AGENTS` | `agents` | S->C | 에이전트 목록 |
| `TEST_AGENT_RESULT` | `testAgentResult` | S->C | 에이전트 테스트 결과 |
| `ERROR` | `error` | S->C | 에러 메시지 |

### ERR (에러 메시지)

| 상수명 | 메시지 |
|--------|--------|
| `INVALID_JSON` | `Invalid JSON` |
| `INVALID_WINDOW` | `Invalid window value` |
| `INVALID_SUBNET` | `Invalid subnet level` |
| `INVALID_SCENARIO` | `Invalid scenario` |
| `INVALID_EPS` | `EPS must be between {min} and {max}` |
| `UNKNOWN_TYPE` | `Unknown message type: {type}` |

---

## 부록 C: 시각화 설정 파라미터 전체 레퍼런스

`src/client/js/config.js`의 `VISUAL_CONFIG (V)` 객체에 정의된 시각화 파라미터입니다.

### 노드 (Node)

| 키 | 기본값 | 단위 | 설명 |
|----|--------|------|------|
| `MIN_RADIUS` | 12 | px | 서브넷 노드 최소 반지름 |
| `MAX_RADIUS` | 50 | px | 서브넷 노드 최대 반지름 |
| `HUB_RADIUS` | 50 | px | 허브 노드 반지름 |
| `HIGHLIGHT_SCALE` | 1.3 | x | 선택 노드 확대 배율 |

### 링크 (Link)

| 키 | 기본값 | 단위 | 설명 |
|----|--------|------|------|
| `LINK_WIDTH_MIN` | 2 | px | 링크 최소 두께 |
| `LINK_WIDTH_MAX` | 4 | px | 링크 최대 두께 |
| `LINK_OPACITY` | 0.5 | | 링크 기본 투명도 |
| `LINK_DISTANCE_NORMAL` | 160 | px | 허브-노드 간 목표 거리 |
| `LINK_DISTANCE_CLUSTER` | 250 | px | 클러스터 피어 간 목표 거리 |
| `LINK_STRENGTH_CLUSTER` | 0.008 | | 클러스터 링크 강도 |
| `LINK_STRENGTH_NORMAL` | 0.04 | | 일반 링크 강도 |

### 라벨 (Label)

| 키 | 기본값 | 단위 | 설명 |
|----|--------|------|------|
| `LABEL_FONT_SIZE` | 11 | px | 서브넷 라벨 글꼴 크기 |
| `CLUSTER_LABEL_FONT_SIZE` | 10 | px | 클러스터 라벨 글꼴 크기 |

### 트랜지션 (Transition)

| 키 | 기본값 | 단위 | 설명 |
|----|--------|------|------|
| `TRANSITION_DURATION` | 400 | ms | 노드/링크 업데이트 트랜지션 |
| `COUNTER_DURATION` | 400 | ms | 통계 카운터 애니메이션 |

### Force 레이아웃 (Force Layout)

| 키 | 기본값 | 단위 | 설명 |
|----|--------|------|------|
| `FORCE_ALPHA_DECAY` | 0.03 | | 시뮬레이션 알파 감쇠율 |
| `FORCE_VELOCITY_DECAY` | 0.55 | | 속도 감쇠율 |
| `FORCE_CHARGE_STRENGTH` | -180 | | 노드 간 반발력 |
| `FORCE_CHARGE_DISTANCE_MAX` | 600 | px | 반발력 최대 적용 거리 |
| `FORCE_COLLIDE_PADDING` | 12 | px | 충돌 감지 여백 |
| `FORCE_COLLIDE_STRENGTH` | 0.8 | | 충돌 힘 강도 |
| `FORCE_COLLIDE_ITERATIONS` | 3 | | 충돌 반복 횟수 |

### 클러스터 (Cluster)

| 키 | 기본값 | 단위 | 설명 |
|----|--------|------|------|
| `CLUSTER_ATTRACT_STRENGTH` | 0.15 | | 클러스터 내 응집력 |
| `CLUSTER_RADIUS_PADDING` | 30 | px | 클러스터 반지름 여백 |
| `CLUSTER_SEPARATION_PUSH` | 0.25 | | 클러스터 간 밀어내기 |
| `CLUSTER_NODE_BUFFER` | 60 | px | 클러스터 노드 버퍼 |
| `CLUSTER_CENTER_BUFFER` | 150 | px | 클러스터 중심 버퍼 |
| `CLUSTER_SEPARATION_MIN` | 150 | px | 클러스터 간 최소 거리 |
| `CLUSTER_SEPARATION_PUSH_FORCE` | 0.5 | | 클러스터 분리 힘 |
| `CLUSTER_HULL_PADDING` | 18 | px | Hull 경계 여백 |
| `CLUSTER_HULL_VISIBLE` | true | | Hull 표시 여부 |
| `CLUSTER_MIN_NODES` | 2 | | Hull 표시 최소 노드 수 |
| `HUB_PUSH_BASE` | 200 | px | 허브 밀어내기 기본 거리 |
| `HUB_PUSH_PER_NODE` | 15 | px | 노드당 추가 허브 밀어내기 |
| `HUB_PUSH_STRENGTH` | 0.6 | | 허브 밀어내기 강도 |
| `HUB_CLAMP_BASE` | 200 | px | 허브 거리 클램프 기본값 |
| `HUB_CLAMP_PER_NODE` | 15 | px | 노드당 추가 클램프 거리 |
| `HUB_CLAMP_VELOCITY_DAMPING` | 0.3 | | 클램프 시 속도 감쇠 |

### 리플 (Ripple)

| 키 | 기본값 | 단위 | 설명 |
|----|--------|------|------|
| `RIPPLE_ENABLED` | true | | 리플 효과 활성 여부 |
| `RIPPLE_BASE_SPREAD` | 50 | px | 기본 리플 확산 범위 |
| `RIPPLE_HIGH_SPREAD` | 30 | px | HIGH 알람 리플 확산 |
| `RIPPLE_MAX_PER_NODE` | 4 | | 노드당 최대 동시 리플 |
| `RIPPLE_STROKE_HIGH` | 3.5 | px | HIGH 리플 선 두께 |
| `RIPPLE_STROKE_MID` | 2.5 | px | MID 리플 선 두께 |
| `RIPPLE_STROKE_LOW` | 1.5 | px | LOW 리플 선 두께 |
| `RIPPLE_DURATION_HIGH` | 600 | ms | HIGH 리플 지속 시간 |
| `RIPPLE_DURATION_NORMAL` | 1000 | ms | 일반 리플 지속 시간 |
| `RIPPLE_OPACITY_HIGH` | 0.8 | | HIGH 리플 투명도 |
| `RIPPLE_OPACITY_NORMAL` | 0.6 | | 일반 리플 투명도 |
| `RIPPLE_INTERVAL_HIGH` | 400 | ms | HIGH 리플 발생 간격 |
| `RIPPLE_INTERVAL_MID` | 700 | ms | MID 리플 발생 간격 |
| `RIPPLE_INTERVAL_LOW` | 1200 | ms | LOW 리플 발생 간격 |
| `RIPPLE_INTERVAL_NONE` | 0 | ms | NONE (리플 없음) |

### 글로우 (Glow)

| 키 | 기본값 | 단위 | 설명 |
|----|--------|------|------|
| `GLOW_ENABLED` | true | | 글로우 효과 활성 여부 |
| `GLOW_RADIUS_HIGH` | 18 | px | HIGH 글로우 반지름 |
| `GLOW_RADIUS_MID` | 12 | px | MID 글로우 반지름 |
| `GLOW_RADIUS_LOW` | 6 | px | LOW 글로우 반지름 |
| `GLOW_OPACITY_HIGH` | 0.6 | | HIGH 글로우 투명도 |
| `GLOW_OPACITY_MID` | 0.45 | | MID 글로우 투명도 |
| `GLOW_OPACITY_LOW` | 0.3 | | LOW 글로우 투명도 |
| `GLOW_OPACITY_NONE` | 0.15 | | NONE 글로우 투명도 |

### 애니메이션 속도 (Animation Duration)

| 키 | 기본값 | 단위 | 설명 |
|----|--------|------|------|
| `ANIM_DURATION_HIGH` | 0.3 | s | HIGH 노드 애니메이션 속도 |
| `ANIM_DURATION_MID` | 0.6 | s | MID 노드 애니메이션 속도 |
| `ANIM_DURATION_LOW` | 1.0 | s | LOW 노드 애니메이션 속도 |
| `ANIM_DURATION_VLOW` | 1.5 | s | VLOW 노드 애니메이션 속도 |
| `ANIM_DURATION_NONE` | 2.5 | s | NONE 노드 애니메이션 속도 |

### 하이라이트 (Highlight)

| 키 | 기본값 | 단위 | 설명 |
|----|--------|------|------|
| `HIGHLIGHT_SCALE` | 1.3 | x | 선택 노드 확대 배율 |
| `HIGHLIGHT_LINK_SCALE` | 2.5 | x | 선택 링크 두께 배율 |
| `HIGHLIGHT_DIM_OPACITY` | 0.15 | | 비선택 노드 투명도 |
| `HIGHLIGHT_LINK_DIM` | 0.05 | | 비선택 링크 투명도 |
| `HIGHLIGHT_LINK_BRIGHT` | 0.9 | | 선택 링크 투명도 |
| `HIGHLIGHT_LABEL_DIM` | 0.1 | | 비선택 라벨 투명도 |
| `HIGHLIGHT_CLUSTER_DIM` | 0.15 | | 비선택 클러스터 투명도 |
| `HIGHLIGHT_HUB_DIM` | 0.4 | | 비선택 허브 투명도 |
| `HIGHLIGHT_FONT_SIZE` | 14px | | 선택 라벨 글꼴 크기 |
| `HIGHLIGHT_FONT_WEIGHT` | 700 | | 선택 라벨 글꼴 굵기 |
| `HIGHLIGHT_TRANSITION` | 150 | ms | 하이라이트 적용 트랜지션 |
| `UNHIGHLIGHT_TRANSITION` | 300 | ms | 하이라이트 해제 트랜지션 |

### 알람 (Alert)

| 키 | 기본값 | 단위 | 설명 |
|----|--------|------|------|
| `ALERT_COLOR` | #c24873 | | 알람 전용 핑크-레드 색상 |
| `HEARTBEAT_DURATION` | 800 | ms | 하트비트 주기 |
| `HEARTBEAT_SCALE_PEAK` | 1.15 | x | 하트비트 최대 확대 |
| `HEARTBEAT_SCALE_DIP` | 0.97 | x | 하트비트 최소 축소 |
| `HEARTBEAT_GLOW_PEAK` | 1.4 | x | 하트비트 글로우 최대 |
| `HEARTBEAT_PAUSE_RATIO` | 0.35 | | 하트비트 정지 비율 |
| `WAVE_COUNT` | 3 | | 파동 링 개수 |
| `WAVE_INTERVAL` | 250 | ms | 파동 링 간격 |
| `WAVE_MAX_SPREAD` | 80 | px | 파동 최대 확산 거리 |
| `WAVE_STROKE_WIDTH` | 2.5 | px | 파동 링 두께 |
| `WAVE_DURATION` | 1200 | ms | 파동 지속 시간 |
| `WAVE_INITIAL_OPACITY` | 0.7 | | 파동 초기 투명도 |

### 줌 (Zoom)

| 키 | 기본값 | 단위 | 설명 |
|----|--------|------|------|
| `ZOOM_MIN` | 0.1 | x | 최소 줌 배율 |
| `ZOOM_MAX` | 4 | x | 최대 줌 배율 |

### PPS 임계값 (`PPS_THRESHOLDS`)

| 키 | 기본값 | 설명 |
|----|--------|------|
| `DEFAULT_HIGH` | 10 | HIGH 알람 기준 PPS |
| `DEFAULT_MID_MULTIPLIER` | 0.5 | MID = HIGH x 0.5 |
| `DEFAULT_LOW_MULTIPLIER` | 0.2 | LOW = HIGH x 0.2 |
| `DEFAULT_VLOW_MULTIPLIER` | 0.25 | VLOW = LOW x 0.25 |

### WebSocket 설정 (`WEBSOCKET_CONFIG`)

| 키 | 기본값 | 설명 |
|----|--------|------|
| `MAX_RECONNECT_ATTEMPTS` | 5 | 최대 재연결 시도 횟수 |
| `BASE_RECONNECT_DELAY` | 3000 | 기본 재연결 대기 시간 (ms) |
| `RECONNECT_BACKOFF` | 1.5 | 재연결 백오프 배율 |
