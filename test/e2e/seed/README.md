# E2E 씨앗 - 왜 두 벌인가

이 디렉터리는 `docker-compose.e2e.yml`의 `seed-*` 서비스가 마이그레이션 직후 돌리는
SQL을 담는다. 목록·정렬·페이지 이동·상세·생성 폼(분류·라벨 선택지) 화면이 보는
행 전부가 여기서 나온다. 왜 HTTP가 아니라 SQL로 넣는지, 격리 계약이 무엇인지,
정렬 키를 어떻게 배치했는지는 `examples.sql` 머리말이 정본이다 - 이 문서는 "파일이
왜 두 벌이고 어느 백엔드가 어느 것을 쓰는가"만 답한다.

## 파일 두 벌, 이유는 테이블 이름 하나

같은 E2E 시나리오를 세 백엔드(FastAPI·NestJS·Rails)에 돌린다(Step 12). 셋 다 같은
id·같은 값·같은 시각의 행을 가져야 같은 단언이 성립하는데, **Rails만 분류·라벨·
조인 테이블의 이름이 다르다** - FastAPI·NestJS는 애초에 이름까지 일치한다(NestJS는
정본 이름을 그대로 선언했다).

|                | 정본(FastAPI)  | NestJS         | Rails(`db/schema.rb`)                                       |
| -------------- | -------------- | -------------- | ----------------------------------------------------------- |
| 분류 레코드    | `categories`   | `categories`   | **`example_categories`**                                    |
| 라벨 레코드    | `tags`         | `tags`         | **`example_tags`**(이름이 겹치지만 뜻이 다르다 - 아래 참고) |
| 예제↔라벨 조인 | `example_tags` | `example_tags` | **`example_taggings`**(복합 PK: `example_id`, `tag_id`)     |
| 예제           | `examples`     | `examples`     | `examples`(컬럼 일치)                                       |

`tags`라는 이름이 정본에서는 **라벨 레코드 테이블**을 가리키지만 Rails
`db/schema.rb`에서는 그 이름이 이미 라벨 레코드 테이블에 쓰이고 있어(우연히
같다) 헷갈리기 쉽다 - 진짜로 갈리는 자리는 **조인 테이블**이다: 정본은 그것도
`example_tags`라 부르고, Rails는 `example_taggings`라 부른다.

그래서:

- **`examples.sql`** - FastAPI·NestJS 공용 한 벌. 테이블 이름이 완전히 같으므로
  같은 파일을 그대로 쓴다. **복사본을 만들지 않는다** - 같은 내용의 파일이
  둘이면 하나만 고쳐지는 자리가 된다.
- **`examples.rails.sql`** - Rails 전용 한 벌. 내용(넣는 id·값·시각)은
  `examples.sql`과 완전히 같고 테이블 이름만 위 표를 따라 바꿨다.

테이블 이름을 SQL 안에서 변수화하지 않는다 - 그러면 이 파일들이 "무엇을
넣는가"를 읽어서 알 수 없는 템플릿이 된다. 대가는 두 벌을 유지하는 비용이고,
감수하는 근거는 위와 같다.

## 어느 백엔드가 어느 파일을 쓰는가

| 프로파일        | compose 서비스 | 쓰는 파일                   |
| --------------- | -------------- | --------------------------- |
| `fastapi`(기본) | `seed-fastapi` | `examples.sql`              |
| `nestjs`        | `seed-nestjs`  | `examples.sql`(정본과 공유) |
| `rails`         | `seed-rails`   | `examples.rails.sql`        |

## 값을 바꿀 때

`examples.sql`을 고치면 **`examples.rails.sql`도 같이 고쳐야 한다** - 자동으로
동기화되지 않는다. id·값·시각이 어긋나면 세 백엔드가 같은 시나리오에서 다른
결과를 내고, 그 차이가 진짜 백엔드 드리프트인지 씨앗이 갈려서인지 구별할 수
없게 된다.
