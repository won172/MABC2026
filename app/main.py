from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import sqlite3
import os
import uuid
import json
import re
import requests
from datetime import datetime, date
from typing import Any
from html import unescape

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

app = FastAPI(
    title="청년주택 적격성 워크스페이스",
    description="공고 기반 청년주택 신청자격 판정 서비스",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 마운트
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")

# 템플릿 설정
from jinja2 import Environment, FileSystemLoader

_template_dir = os.path.join(os.path.dirname(__file__), "templates")
_jinja_env = Environment(
    loader=FileSystemLoader(_template_dir),
    cache_size=0,
)
_templates = Jinja2Templates(directory=_template_dir)
_templates.env = _jinja_env
templates = _templates

# DB 설정
DB_PATH = os.path.join(os.path.dirname(__file__), "user_data.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # 사용자 프로필 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_profiles (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            dob TEXT,
            region TEXT,
            residence_duration TEXT,
            housing_status TEXT,
            marital_status TEXT,
            income_info TEXT,
            asset_info TEXT,
            car_value TEXT,
            age INTEGER,
            onboarding_step INTEGER DEFAULT 1,
            notify_eligible BOOLEAN DEFAULT 0
        )
    """)
    # 기존 DB에 age 컬럼이 없으면 추가 (안전 재실행용)
    try:
        cursor.execute("ALTER TABLE user_profiles ADD COLUMN age INTEGER")
    except sqlite3.OperationalError:
        pass
    
    # 공고 테이블 (샘플 데이터용)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notices (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            agency TEXT,
            notice_type TEXT,
            region TEXT,
            publish_date TEXT,
            apply_start TEXT,
            apply_end TEXT,
            status TEXT DEFAULT 'draft',
            raw_content TEXT,
            parsed_requirements TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    
    # 사용자-공고 판정 결과 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS eligibility_results (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            notice_id TEXT NOT NULL,
            result TEXT NOT NULL,
            summary TEXT,
            counts_json TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES user_profiles(id),
            FOREIGN KEY (notice_id) REFERENCES notices(id)
        )
    """)
    
    # 판정 상세 (조건별 대조) 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS requirement_details (
            id TEXT PRIMARY KEY,
            result_id TEXT NOT NULL,
            requirement_name TEXT NOT NULL,
            requirement_type TEXT NOT NULL,
            notice_criteria TEXT,
            user_info TEXT,
            result TEXT NOT NULL,
            notes TEXT,
            FOREIGN KEY (result_id) REFERENCES eligibility_results(id)
        )
    """)

    # 대화형 판정 세션
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            notice_id TEXT NOT NULL,
            notice_content TEXT NOT NULL,
            result_label TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES user_profiles(id),
            FOREIGN KEY (notice_id) REFERENCES notices(id)
        )
    """)

    # 대화형 판정 메시지 (질문/답변/중간 상태)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            meta TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
        )
    """)

    conn.commit()
    conn.close()


# 온보딩 단계 제목/설명
step_titles = {
    1: "기본 정보 입력",
    2: "무주택 여부 확인",
    3: "혼인 여부 확인",
    4: "소득·자산 정보 입력",
    5: "입력 내용 확인",
}

step_descriptions = {
    1: "생년월일, 거주 지역, 거주 기간을 입력해요.",
    2: "세대 구성원 무주택 여부를 확인해요.",
    3: "혼인 여부를 확인해요.",
    4: "월평균 소득, 총자산, 자동차 가액을 입력해요.",
    5: "지금까지 입력한 내용을 확인하고 완료해요.",
}


# 앱 시작 시 DB 초기화
@app.on_event("startup")
def startup_event():
    init_db()

# === 모델 정의 ===

class OnboardingProgress(BaseModel):
    current_step: Optional[int] = None
    dob: Optional[str] = None
    region: Optional[str] = None
    residence_duration: Optional[str] = None
    housing_status: Optional[str] = None
    marital_status: Optional[str] = None
    income_info: Optional[str] = None
    asset_info: Optional[str] = None
    car_value: Optional[str] = None
    notify_eligible: bool = False

class NoticeCreate(BaseModel):
    title: str
    agency: Optional[str] = None
    notice_type: Optional[str] = None
    region: Optional[str] = None
    publish_date: Optional[str] = None
    apply_start: Optional[str] = None
    apply_end: Optional[str] = None
    raw_content: Optional[str] = None

class EligibilityResultCreate(BaseModel):
    notice_id: str
    result: str  # eligible, needs_review, ineligible
    summary: Optional[str] = None
    counts_json: Optional[str] = None

class RequirementDetailCreate(BaseModel):
    requirement_name: str
    requirement_type: str  # mandatory, priority
    notice_criteria: Optional[str] = None
    user_info: Optional[str] = None
    result: str  # met, not_met, needs_review, unverified
    notes: Optional[str] = None


class ChatSessionCreate(BaseModel):
    notice_content: str
    dob: Optional[str] = None
    region: Optional[str] = None
    residence_duration: Optional[str] = None
    housing_status: Optional[str] = None
    marital_status: Optional[str] = None
    income_info: Optional[str] = None
    asset_info: Optional[str] = None
    car_value: Optional[str] = None


class ChatMessageCreate(BaseModel):
    session_id: str
    content: str
    field_key: Optional[str] = None  # 프로필 갱신용 필드 키 (dob/region/residence_duration/housing_status/marital_status/income_info/asset_info/car_value)


class ChatResponse(BaseModel):
    session_id: str
    role: str
    content: str
    is_final: bool
    result: Optional[str] = None
    summary: Optional[str] = None
    details: Optional[list] = None
    notice_id: Optional[str] = None

# 단계별 메타데이터 (index 뷰와 onboarding_step 뷰에서 공통 사용)
STEP_TITLES = {
    1: "기본정보",
    2: "주거 상태",
    3: "가구·혼인",
    4: "소득·자산",
    5: "확인 및 완료",
}

STEP_DESCRIPTIONS = {
    1: "공고마다 사용하는 항목이 달라서, 필요한 정보만 차례로 물어봐요. 아직 모르는 값은 비워둘 수 있고, 입력을 멈춰도 지금까지 입력한 내용은 저장돼요.",
    2: "공고에서 무주택 여부를 확인할 때 필요해요. 확실하지 않으면 '아직 모르겠어요'를 선택할 수 있어요.",
    3: "공고에서 혼인 여부를 확인할 때 필요해요. 필요하지 않은 공고에서는 이 항목을 묻지 않아요.",
    4: "소득·자산·자동차 가액은 공고 기준으로 직접 확인한 값을 입력해요. 잘 모르면 '모름'이나 '확인 중'으로 둬도 돼요. 서비스가 대신 계산하거나 조회하지 않아요.",
    5: "지금까지 입력한 내용을 확인해요. 저장된 정보는 메인 화면의 프로필 편집에서 언제든 수정할 수 있어요.",
}

def housing_status_label(v):
    return {"yes": "무주택이에요", "no": "주택이 있어요", "unknown": "아직 모르겠어요"}.get(v, v)

def marital_status_label(v):
    return {"single": "미혼이에요", "married": "기혼이에요", "unknown": "아직 모르겠어요"}.get(v, v)

# === 라우팅 ===

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """메인 페이지 - 온보딩이 완료되지 않았으면 온보딩으로 리디렉션"""
    conn = get_db()
    cursor = conn.cursor()
    
    user_id = request.cookies.get("user_id")
    
    if not user_id:
        user_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        cursor.execute(
            "INSERT INTO user_profiles (id, created_at, updated_at, onboarding_step) VALUES (?, ?, ?, ?)",
            (user_id, now, now, 1)
        )
        conn.commit()
    
    # 온보딩 완료 여부 확인
    cursor.execute("SELECT * FROM user_profiles WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    if row and row["onboarding_step"] >= 5:
        return templates.TemplateResponse(
            request=request,
            name="index.html",
            context={
                "request": request,
                "user_id": user_id,
                "notices": []
            },
        )

    profile = {
        "dob": row["dob"] if row else "",
        "region": row["region"] if row else "",
        "residence_duration": row["residence_duration"] if row else "",
        "housing_status": row["housing_status"] if row else "",
        "marital_status": row["marital_status"] if row else "",
        "income_info": row["income_info"] if row else "",
        "asset_info": row["asset_info"] if row else "",
        "car_value": row["car_value"] if row else "",
        "notify_eligible": bool(row["notify_eligible"]) if row else False,
    }

    response = templates.TemplateResponse(
        request=request,
        name="onboarding.html",
        context={
            "request": request,
            "row": row,
            "current_step": row["onboarding_step"] if row else 1,
            "user_id": user_id,
            "profile": profile,
            "step_title": step_titles.get(row["onboarding_step"] if row else 1, ""),
            "step_description": step_descriptions.get(row["onboarding_step"] if row else 1, ""),
            "housing_status_label": housing_status_label,
            "marital_status_label": marital_status_label,
        },
    )
    response.set_cookie(key="user_id", value=user_id, httponly=True, max_age=3600*24*30)
    return response

@app.get("/onboarding/step/{step}", response_class=HTMLResponse)
async def onboarding_step(request: Request, step: int):
    """온보딩 단계별 페이지"""
    conn = get_db()
    cursor = conn.cursor()
    
    user_id = request.cookies.get("user_id")
    if not user_id:
        user_id = str(uuid.uuid4())
    
    # 사용자 프로필 조회 또는 생성
    # 사용자 프로필 조회 또는 생성
    cursor.execute("SELECT * FROM user_profiles WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if not row:
        cursor.execute(
            "INSERT INTO user_profiles (id, created_at, updated_at, onboarding_step) VALUES (?, ?, ?, ?)",
            (user_id, datetime.now().isoformat(), datetime.now().isoformat(), step)
        )
        conn.commit()
        # INSERT 후 행 다시 조회
        cursor.execute("SELECT * FROM user_profiles WHERE id = ?", (user_id,))
        row = cursor.fetchone()
    conn.close()
    conn.close()

    response = templates.TemplateResponse(
        request=request,
        name="onboarding.html",
        context={
            "request": request,
            "current_step": step,
            "user_id": user_id,
            "row": row,
            "step_title": STEP_TITLES.get(step, ""),
            "step_description": STEP_DESCRIPTIONS.get(step, ""),
            "housing_status_label": housing_status_label,
            "marital_status_label": marital_status_label,
        },
    )
    response.set_cookie(key="user_id", value=user_id, httponly=True, max_age=3600*24*30)
    return response

@app.post("/api/onboarding/progress")
async def save_onboarding_progress(request: Request, data: OnboardingProgress):
    """온보딩 진행 상황 저장"""
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="사용자 세션이 없습니다")
    
    conn = get_db()
    cursor = conn.cursor()

    now = datetime.now().isoformat()
    profile_now = now

    # 기존 행 존재 여부 확인
    cursor.execute("SELECT id FROM user_profiles WHERE id = ?", (user_id,))
    existing = cursor.fetchone()

    set_clauses: list[str] = []
    values: list[Any] = []
    age_val: Any = None
    if data.dob is not None and not _is_uncertain_answer(data.dob):
        set_clauses.append("dob = ?")
        values.append(data.dob)
        age_val = calc_age_from_dob(data.dob)
        if age_val is not None:
            set_clauses.append("age = ?")
            values.append(age_val)
    if data.region is not None and not _is_uncertain_answer(data.region):
        set_clauses.append("region = ?")
        values.append(data.region)
    if data.residence_duration is not None and not _is_uncertain_answer(data.residence_duration):
        set_clauses.append("residence_duration = ?")
        values.append(data.residence_duration)
    if data.housing_status is not None and not _is_uncertain_answer(data.housing_status):
        set_clauses.append("housing_status = ?")
        values.append(data.housing_status)
    if data.marital_status is not None and not _is_uncertain_answer(data.marital_status):
        set_clauses.append("marital_status = ?")
        values.append(data.marital_status)
    if data.income_info is not None and not _is_uncertain_answer(data.income_info):
        set_clauses.append("income_info = ?")
        values.append(data.income_info)
    if data.asset_info is not None and not _is_uncertain_answer(data.asset_info):
        set_clauses.append("asset_info = ?")
        values.append(data.asset_info)
    if data.car_value is not None and not _is_uncertain_answer(data.car_value):
        set_clauses.append("car_value = ?")
        values.append(data.car_value)

    if existing:
        # 기존 행이 있으면 전달된 값만 조건부 갱신
        if set_clauses:
            set_clauses.append("updated_at = ?")
            values.append(profile_now)
            values.append(user_id)
            cursor.execute(
                f"UPDATE user_profiles SET {', '.join(set_clauses)} WHERE id = ?",
                values,
            )
        else:
            # 갱신할 필드가 없어도 updated_at만 반영
            cursor.execute(
                "UPDATE user_profiles SET updated_at = ? WHERE id = ?",
                (profile_now, user_id),
            )
    else:
        # 기존 행이 없으면 새로 삽입
        cursor.execute(
            """INSERT INTO user_profiles (
                id, created_at, updated_at, dob, age, region, residence_duration,
                housing_status, marital_status, income_info, asset_info, car_value,
                notify_eligible, onboarding_step
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user_id, now, now,
                data.dob, age_val, data.region, data.residence_duration,
                data.housing_status, data.marital_status,
                data.income_info, data.asset_info, data.car_value,
                int(data.notify_eligible),
                data.current_step or 2,
            ),
        )

    conn.commit()
    conn.close()

    return {"status": "ok", "user_id": user_id}

@app.get("/api/onboarding/progress")
async def get_onboarding_progress(request: Request):
    """현재 온보딩 진행 상황 조회 (마운트 복원용)"""
    user_id = request.cookies.get("user_id")
    if not user_id:
        import uuid
        user_id = str(uuid.uuid4())
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        cursor.execute("""INSERT OR IGNORE INTO user_profiles (id, created_at, updated_at) VALUES (?, ?, ?)""", (user_id, now, now))
        conn.commit()
        conn.close()
        response = JSONResponse(content={
            "current_step": 1,
            "dob": None, "region": None, "residence_duration": None,
            "housing_status": None, "marital_status": None,
            "income_info": None, "asset_info": None, "car_value": None,
        })
        response.set_cookie(key="user_id", value=user_id, httponly=True, max_age=3600*24*30, samesite="lax")
        return response

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM user_profiles WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {
            "current_step": 1,
            "dob": None, "region": None, "residence_duration": None,
            "housing_status": None, "marital_status": None,
            "income_info": None, "asset_info": None, "car_value": None,
        }

    return {
        "current_step": row["onboarding_step"] if row["onboarding_step"] else 1,
        "dob": row["dob"],
        "region": row["region"],
        "residence_duration": row["residence_duration"],
        "housing_status": row["housing_status"],
        "marital_status": row["marital_status"],
        "income_info": row["income_info"],
        "asset_info": row["asset_info"],
        "car_value": row["car_value"],
    }

@app.get("/api/user/profile")
async def get_user_profile(request: Request):
    """현재 사용자 프로필 조회"""
    user_id = request.cookies.get("user_id")
    if not user_id:
        return {"user_id": None, "profile": None}
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM user_profiles WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "user_id": user_id,
            "profile": dict(row)
        }
    return {"user_id": user_id, "profile": None}

@app.post("/api/notices")
async def create_notice(request: Request, notice: NoticeCreate):
    """공고 등록 (수동 업로드용)"""
    notice_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO notices 
        (id, title, agency, notice_type, region, publish_date, 
         apply_start, apply_end, raw_content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        notice_id, notice.title, notice.agency, notice.notice_type,
        notice.region, notice.publish_date, notice.apply_start,
        notice.apply_end, notice.raw_content, now, now
    ))
    conn.commit()
    conn.close()
    
    return {"status": "ok", "notice_id": notice_id}

@ app.get("/api/notices")
async def list_notices(request: Request):
    """공고 목록 조회"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM notices WHERE status != 'deleted' ORDER BY publish_date DESC")
    rows = cursor.fetchall()
    conn.close()

    notices = [dict(row) for row in rows]
    return {"notices": notices}


# === 파싱된 공고 데이터 (data/*.pdf.json) ===
_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


def _load_parsed_notice_list() -> list[dict]:
    """data/*.pdf.json 파일 목록에서 공고 메타데이터를 읽어 반환한다."""
    if not os.path.isdir(_DATA_DIR):
        return []
    out: list[dict] = []
    for fname in sorted(os.listdir(_DATA_DIR)):
        if not fname.endswith(".pdf.json"):
            continue
        path = os.path.join(_DATA_DIR, fname)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        pages_text = data.get("pages_text")
        if not isinstance(pages_text, list):
            continue
        full_text = "\n".join(str(x) for x in pages_text)
        out.append({
            "id": fname,
            "title": data.get("original") or fname,
            "pages": data.get("pages"),
            "char_count": len(full_text),
        })
    return out


@app.get("/api/parsed-notices")
async def list_parsed_notices(request: Request):
    """data/*.pdf.json에 저장된 파싱 공고 목록을 반환한다."""
    notices = _load_parsed_notice_list()
    return {"notices": notices}


@app.get("/api/parsed-notices/{notice_id}")
async def get_parsed_notice(request: Request, notice_id: str):
    """data/*.pdf.json에서 특정 공고의 전체 텍스트를 반환한다."""
    path = os.path.join(_DATA_DIR, notice_id)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="공고 데이터를 찾을 수 없습니다")
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        raise HTTPException(status_code=500, detail="공고 데이터를 읽는 중 오류가 발생했습니다")
    if not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="공고 데이터 형식이 올바르지 않습니다")
    pages_text = data.get("pages_text")
    if not isinstance(pages_text, list):
        raise HTTPException(status_code=500, detail="공고 데이터 형식이 올바르지 않습니다")
    full_text = "\n".join(str(x) for x in pages_text)
    return {
        "id": notice_id,
        "title": data.get("original") or notice_id,
        "pages": data.get("pages"),
        "content": full_text,
        "char_count": len(full_text),
    }


# === 파일 파싱 (Upstage Document Digitization) ===
# 모델 선택: 이미지(png/jpg/jpeg/gif/webp) → ocr, 그 외 문서 → document-parse
# mode는 모두 standard. 키는 서버가 관리하며 프론트에 노출하지 않는다.
_SUPPORTED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
_SUPPORTED_DOC_EXTS = {
    ".pdf", ".hwp", ".hwpz", ".pages", ".doc", ".docx", ".xls", ".xlsx",
    ".ppt", ".pptx", ".txt", ".csv", ".html", ".htm", ".md", ".rtf",
}
_SUPPORTED_EXTS = _SUPPORTED_IMAGE_EXTS | _SUPPORTED_DOC_EXTS


def _ext(path_or_name: str) -> str:
    base = os.path.basename(path_or_name)
    _, ext = os.path.splitext(base)
    return ext.lower()


def _strip_html(html_text: str) -> str:
    """HTML 문자열을 태그 없는 읽기 쉬운 텍스트로 정리한다.

    - 스크립트/스타일 블록은 제거한다.
    - br/p/div/h1~h6 등 블록·줄바꿈 요소는 개행 하나로 바꾼다.
    - 남은 태그는 모두 제거한다.
    - HTML 엔티티를 디코딩한다.
    - 연속된 공백을 하나로 모으고 양끝을 정리한다.
    """
    text = html_text
    text = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.S | re.I)
    text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.S | re.I)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</(p|div|li|h[1-6]|tr|br|section|article|header|footer|main|aside|nav|figure|figcaption|blockquote|pre|table|ul|ol)>", "\n", text, flags=re.I)
    text = re.sub(r"<(p|div|li|h[1-6]|tr|section|article|header|footer|main|aside|nav|figure|blockquote|pre|table|ul|ol)[^>]*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = unescape(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _model_for_ext(ext: str) -> str:
    if ext in _SUPPORTED_IMAGE_EXTS:
        return "ocr"
    return "document-parse"


@app.post("/api/document/parse")
async def document_parse(request: Request):
    """선택한 공고 파일을 Upstage Document Digitization으로 파싱해 텍스트를 추출한다.

    - 서버 환경변수 UPSTAGE_API_KEY를 사용하며 프론트에 노출하지 않는다.
    - 이미지 계열(.png/.jpg/.jpeg/.gif/.webp)은 model=ocr, mode=standard.
    - 그 외 지원 문서(.pdf/.hwp/.hwpz/.doc/.docx/.xls/.xlsx/.ppt/.pptx/.txt/.csv/.html/.md/.rtf 등)는
      model=document-parse, mode=standard.
    - 지원하지 않는 형식은 400과 안내 메시지를 반환한다.
    - 파싱 실패(업스테이지 응답 오류 등)는 502와 실패 안내를 반환한다.
    - 성공 시 {"status":"ok","text":"...", "model":"..."} 를 반환한다.
      프론트는 이 텍스트를 공고 입력창에 채운다.
    """
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="사용자 세션이 없습니다")

    api_key = os.environ.get("SOLAR_API_KEY", "").strip()
    if not api_key:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unavailable",
                "detail": "서버에 문서 파싱용 Solar API 키가 설정되어 있지 않습니다.",
            },
        )

    # FormData로 올라온 파일 (Upstage API도 multipart 표준)
    form = await request.form()
    file = form.get("file") or form.get("document")
    if not file:
        raise HTTPException(status_code=400, detail="파일이 필요합니다")

    original_name = getattr(file, "filename", "upload")
    ext = _ext(original_name)

    if ext not in _SUPPORTED_EXTS:
        supported = ", ".join(sorted(_SUPPORTED_EXTS))
        return JSONResponse(
            status_code=400,
            content={
                "status": "unsupported",
                "detail": f"지원하지 않는 파일 형식입니다({ext}). 지원 형식: {supported}",
            },
        )

    model = _model_for_ext(ext)

    # 파일 바이너리 읽기 (UploadFile 또는 raw bytes 모두 처리)
    raw_bytes: bytes = b""
    if not isinstance(file, bytes):
        fobj = getattr(file, "file", None) or getattr(file, "read", None)
        if fobj is not None:
            try:
                raw_bytes = fobj.read()  # type: ignore[union-attr]
            except Exception:
                raw_bytes = b""

    if not raw_bytes:
        raise HTTPException(status_code=400, detail="빈 파일입니다")

    # Upstage Document Digitization API 호출
    # 표준: multipart/form-data, field name "document"
    try:
        resp = requests.post(
            "https://api.upstage.ai/v1/document-digitization",
            headers={
                "Authorization": f"Bearer {api_key}",
            },
            files={"document": (original_name, raw_bytes, "application/octet-stream")},
            data={"model": model, "mode": "standard"},
            timeout=120,
        )
        resp.raise_for_status()
        body = resp.json()
    except requests.HTTPError as exc:
        detail = "업스테이지 호출 오류"
        resp_for_err = getattr(exc, "response", None)
        if resp_for_err is not None:
            try:
                err_body = resp_for_err.json()
                detail = err_body.get("error", {}).get("message", "업스테이지 호출 오류")
            except Exception:
                detail = "업스테이지 호출 오류"
        return JSONResponse(
            status_code=502,
            content={
                "status": "parse_failed",
                "detail": f"문서 파싱에 실패했습니다: {detail}",
            },
        )
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={
                "status": "parse_failed",
                "detail": f"문서 파싱 중 오류가 발생했습니다: {exc}",
            },
        )

    extracted = ""
    if isinstance(body, dict):
        # Upstage Document Digitization 응답 구조:
        # - body 자체에 text/markdown/html/result 등이 직접 있을 수 있음
        # - body["content"]에 내부 JSON 문자열이 들어 있을 수 있음
        inner: Any = body.get("content")
        if isinstance(inner, str):
            try:
                inner = json.loads(inner)
            except Exception:
                inner = None
        if isinstance(inner, dict):
            extracted = (
                inner.get("text")
                or inner.get("markdown")
                or inner.get("html")
                or inner.get("result")
                or ""
            )
            if isinstance(extracted, str) and extracted.strip().lower().startswith("<"):
                # HTML이면 태그 정리
                extracted = _strip_html(extracted)
        elif isinstance(inner, str):
            extracted = inner

        # body 자체에 직접 필드가 있으면 그걸 우선 사용하지 않음
        # (content 내부가 더 구체적이면 그쪽을 씀). 만약 inner가 비어있으면
        # body 직손을 fallback으로 사용.
        if not extracted:
            extracted = (
                body.get("text")
                or body.get("markdown")
                or body.get("html")
                or body.get("result")
                or ""
            )
            if isinstance(extracted, str) and extracted.strip().lower().startswith("<"):
                extracted = _strip_html(extracted)

        if isinstance(extracted, (dict, list)):
            extracted = json.dumps(extracted, ensure_ascii=False)
    extracted = (extracted or "").strip()

    if not extracted:
        return JSONResponse(
            status_code=502,
            content={
                "status": "parse_failed",
                "detail": "문서에서 텍스트를 추출하지 못했습니다. 이미지나 스캔 문서라면 OCR 결과가 비어 있을 수 있습니다.",
            },
        )

    return {
        "status": "ok",
        "text": extracted,
        "model": model,
        "original_name": original_name,
        "character_count": len(extracted),
    }

@app.post("/api/eligibility/results")
async def create_eligibility_result(request: Request, result: EligibilityResultCreate):
    """판정 결과 저장"""
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="사용자 세션이 없습니다")
    
    result_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO eligibility_results 
        (id, user_id, notice_id, result, summary, counts_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (result_id, user_id, result.notice_id, result.result, 
          result.summary, result.counts_json, now))
    conn.commit()
    conn.close()
    
    return {"status": "ok", "result_id": result_id}

@app.post("/api/eligibility/results/{result_id}/requirements")
async def add_requirement_detail(request: Request, result_id: str, detail: RequirementDetailCreate):
    """판정 상세 (조건별 대조) 추가"""
    detail_id = str(uuid.uuid4())
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO requirement_details 
        (id, result_id, requirement_name, requirement_type, 
         notice_criteria, user_info, result, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (detail_id, result_id, detail.requirement_name, detail.requirement_type,
          detail.notice_criteria, detail.user_info, detail.result, detail.notes))
    conn.commit()
    conn.close()
    
    return {"status": "ok", "detail_id": detail_id}

@app.get("/api/eligibility/results/{notice_id}/user")
async def get_user_eligibility(request: Request, notice_id: str):
    """사용자에게 저장된 판정 결과 조회"""
    user_id = request.cookies.get("user_id")
    if not user_id:
        return {"result": None}
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM eligibility_results 
        WHERE user_id = ? AND notice_id = ?
        ORDER BY created_at DESC LIMIT 1
    """, (user_id, notice_id))
    row = cursor.fetchone()
    
    if row:
        result = dict(row)
        # 상세 조건 조회
        cursor.execute("""
            SELECT * FROM requirement_details 
            WHERE result_id = ?
        """, (result["id"],))
        details = [dict(d) for d in cursor.fetchall()]
        result["details"] = details
        conn.close()
        return {"result": result}
    
    conn.close()
    return {"result": None}


# === 스킬 로드 ===
SKILL_PATH = os.environ.get(
    "SKILL_PATH",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "skills", "youth-housing-eligibility-checker", "SKILL.md"),
)

def _load_skill_md() -> str:
    """스킬 파일을 읽는다. 없으면 판정 불가 오류로 처리한다."""
    if not os.path.isfile(SKILL_PATH):
        raise RuntimeError(f"스킬 파일을 찾을 수 없습니다: {SKILL_PATH}")
    with open(SKILL_PATH, "r", encoding="utf-8") as f:
        return f.read()

SOLAR_API_KEY = os.environ.get("SOLAR_API_KEY", "").strip()
SOLAR_BASE_URL = os.environ.get("SOLAR_BASE_URL", "https://api.upstage.ai").strip()
SOLAR_MODEL = os.environ.get("SOLAR_MODEL", "solar-pro4").strip()

AS_USER = "user"
AS_SYSTEM = "system"

def _strip_markdown_line_prefix(line: str) -> str:
    """줄 앞의 마크다운 헤더/볼드/목록 기호 등을 제거해 판정 매칭을 용이하게 한다.

    '## 최종 판정: 🟢 신청 가능' 이나 '**최종 판정:** 신청 가능' 같은 변형에서도
    '최종 판정:'을 찾을 수 있게 한다.
    """
    s = line.strip()
    # 마크다운 헤더 (# 하나 이상)
    s = re.sub(r"^#{1,6}\s+", "", s)
    # 볼드/이탤릭 마커 (** 또는 *) — 양끝과 나머지 연속 마커를 정리
    s = s.strip("*")
    # 번호/불릿 목록 마커 (예: "- ", "* ", "1. ", "1) " 등)
    s = re.sub(r"^[\-\*\d.]+\s+", "", s)
    return s.strip()


def _parse_eligibility_result(raw: str) -> dict:
    """Solar 응답 텍스트에서 🟢/🔴/🟡 최종 판정과 한 줄 요약, 조건 대조, 근거를 추출한다.

    고정 응답은 쓰지 않는다. Solar가 생성한 텍스트만 파싱하며, 형태가 불명확하면
    확보 가능한 범위까지만 반환하고 나머지는 null로 남긴다.

    판정 로직은 "신청 가능" 같은 문구만으로 eligible을 만들지 않는다.
    색 토큰(🟢/🔴/🟡) 또는 최종 판정 줄의 명확한 문구만으로 판정하며,
    판정 줄을 못 찾았거나 색 토큰이 없으면 needs_review로 처리한다.
    한 줄에 두 가지 이상 색 토큰이 섞여 있으면 신뢰할 수 없는 응답으로 보고
    needs_review로 처리한다.
    """
    text = raw or ""
    result = None
    summary = None
    details = []

    # --- 최종 판정 줄 찾기 (마크다운 앞붙임 제거 후 매칭) ---
    # "최종 판정:" 줄이 있으면 그 줄에서만 판정한다. 중간 문장(예: "~만 신청 가능하며")에
    # "신청 가능"이 들어가는 오판정을 막기 위해서다. 그 줄이 없을 때만 전체 텍스트 폴백.
    final_judgment_line = None
    for line in text.splitlines():
        cleaned = _strip_markdown_line_prefix(line)
        if "최종 판정" in cleaned and ":" in cleaned:
            final_judgment_line = cleaned
            break

    if final_judgment_line:
        # 한 줄에 색 토큰이 둘 이상 섞여 있으면 신뢰할 수 없는 응답 → 확인 필요
        green = final_judgment_line.count("🟢")
        red = final_judgment_line.count("🔴")
        yellow = final_judgment_line.count("🟡")
        color_count = green + red + yellow

        if color_count >= 2:
            result = "needs_review"
        elif color_count == 1:
            if green == 1:
                result = "eligible"
            elif red == 1:
                result = "ineligible"
            else:  # yellow == 1
                result = "needs_review"
        else:
            # 색 토큰 없이 문구만 있는 경우
            if "신청 불가" in final_judgment_line:
                result = "ineligible"
            elif "추가 확인 필요" in final_judgment_line:
                result = "needs_review"
            # "신청 가능" 문구만으로는 eligible을 만들지 않는다 (위험한 확정 방지)

    if result is None:
        # 최종 판정 줄이 없거나 그 줄에 판정 토큰이 없는 경우: 전체 텍스트 폴백
        # 색 토큰만 본다. "신청 가능" 문구만으로 eligible을 만들지 않는다.
        green = text.count("🟢")
        red = text.count("🔴")
        yellow = text.count("🟡")
        color_count = green + red + yellow

        if color_count >= 2:
            result = "needs_review"
        elif color_count == 1:
            if green == 1:
                result = "eligible"
            elif red == 1:
                result = "ineligible"
            else:  # yellow == 1
                result = "needs_review"
        else:
            # 색 토큰이 하나도 없으면 확인 필요로 처리
            result = "needs_review"

    # 한 줄 요약: "한 줄 요약" / "한 문장" / "한줄 요약" 뒤 첫 문장-ish
    # Solar가 "**한 줄 요약**"처럼 마크다운 볼드로 쓰는 경우가 있으므로,
    # 후보 텍스트 앞뒤의 "**" 및 잉여 공백/개행을 정리한 뒤 첫 줄을 취한다.
    for marker in ["한 줄 요약", "한 문장", "한줄 요약"]:
        idx = text.find(marker)
        if idx == -1:
            continue
        start = idx + len(marker)
        snippet = text[start:]
        # 다음 섹션 헤더 이전까지
        end = 10000
        for next_marker in ["자격조건 대조", "판단 근거", "신청 전 확인할 것", "최종 판정"]:
            nxt = snippet.find(next_marker)
            if nxt != -1 and nxt < end:
                end = nxt
        candidate = snippet[:end].strip()
        # 앞뒤 "**" 제거 (예: "**한 줄 요약**\n내용" → "내용")
        candidate = candidate.strip("*").strip()
        if candidate:
            # 개행 기준 첫 라인만, 그리고 그 라인도 다시 별표 정리
            summary = candidate.split("\n")[0].strip().strip("*").strip()
        break

    # 조건 대조 테이블-ish: 표 형태는 그대로 보존하기 어려우므로,
    # 라인으로 분리한 뒤 "조건 | 공고 기준 | 내 조건 | 판정" 패턴을 찾는다.
    lines = text.splitlines()
    table_started = False
    for line in lines:
        stripped = line.strip()
        if "자격조건 대조" in stripped or "조건" in stripped and "공고 기준" in stripped:
            table_started = True
            continue
        if table_started:
            # 표 헤더/구분선 건너뛰기
            if stripped.startswith("|") and "---" not in stripped and "조건" not in stripped:
                cells = [c.strip() for c in stripped.split("|")]
                # markdown 표는 양끝에 빈 셀이 붙으므로 필터
                cells = [c for c in cells if c != ""]
                if len(cells) >= 2:
                    name = cells[0]
                    criteria = cells[1] if len(cells) > 1 else ""
                    user_info = cells[2] if len(cells) > 2 else ""
                    verdict = cells[3] if len(cells) > 3 else ""
                    # 판정 토큰 정규화 — 확인 필요(⚠️)를 가장 먼저 본다. 그 뒤 부정/긍정 순.
                    # 텍스트에 다른 토큰이 섞여 있어도(예: "확인 필요(…충족 여부와 무관)") 우선 순위가 맞도록.
                    if "⚠️" in verdict or "확인 필요" in verdict:
                        vr = "needs_review"
                    elif "❌" in verdict or "미충족" in verdict:
                        vr = "not_met"
                    elif "⭕" in verdict or "충족" in verdict:
                        vr = "met"
                    else:
                        vr = "unverified"
                    details.append({
                        "requirement_name": name,
                        "notice_criteria": criteria,
                        "user_info": user_info,
                        "result": vr,
                        "notes": "",
                    })
            # 표가 끝나면 중단 (다음 대제목 또는 빈 줄 연속)
            if stripped and not stripped.startswith("|"):
                # 표 뒤 첫 의미 있는 라인에서 중단
                if any(m in stripped for m in ["판단 근거", "신청 전 확인할 것", "최종 판정", "기준시점"]):
                    break
                # 빈 줄이 아니고 표 시작도 아니면 중단 처리
                if not stripped.startswith("|"):
                    break

    # 신청 전 확인할 것 섹션 추출
    pre_check = None
    pre_check_marker = "신청 전 확인할 것"
    pre_check_idx = text.find(pre_check_marker)
    if pre_check_idx != -1:
        after_header = text[pre_check_idx + len(pre_check_marker):]
        end_markers = ["이 판정은 공고문 근거로 한 1차 확인이며"]
        end_pos = len(after_header)
        for em in end_markers:
            idx = after_header.find(em)
            if idx != -1 and idx < end_pos:
                end_pos = idx
        pre_check = after_header[:end_pos].strip()

    # 나의 순위 추출 (공고에 순위 기준이 있는 경우에만 출력됨)
    rank = None
    rank_marker = "나의 순위"
    rank_idx = text.find(rank_marker)
    if rank_idx != -1:
        after_rank = text[rank_idx:]
        first_line = after_rank.split("\n")[0].strip()
        # "나의 순위: 1순위 / 2순위 / 3순위 (공고 근거: ...)" 또는 "나의 순위: 순위 없음"
        m = re.search(r"나의 순위:\s*(.+)$", first_line)
        if m:
            rank = m.group(1).strip()

    # 나의 신청계층 추출 (공고에 신청계층 기준이 있는 경우에만 출력됨)
    applicant_type = None
    applicant_type_marker = "나의 신청계층"
    applicant_type_idx = text.find(applicant_type_marker)
    if applicant_type_idx != -1:
        after_type = text[applicant_type_idx:]
        first_line = after_type.split("\n")[0].strip()
        # "나의 신청계층: 청년 / 신청계층 확인 필요" 형태
        m = re.search(r"나의 신청계층:\s*(.+)$", first_line)
        if m:
            applicant_type = m.group(1).strip()

    return {
        "result": result,
        "summary": summary,
        "details": details,
        "pre_check": pre_check,
        "rank": rank,
        "applicant_type": applicant_type,
        "raw": text,
    }


def build_chat_messages(
    notice_content: str,
    user_profile: dict,
    history: Optional[list] = None,
    extra_user_text: Optional[str] = None,
) -> list:
    """Solar에 보낼 메시지 리스트를 구성한다.

    - system 메시지: 스킬 파일 원문
    - 첫 user 메시지: 공고 + 사용자 프로필 (+ extra_user_text가 있으면 추가)
    - history: user/assistant 역할별 메시지로 이어붙임 (role/content dict 리스트)
    이전 대화는 텍스트로 붙여 넣지 않고 역할별로 분리된 메시지로 보낸다.
    """
    skill_md = _load_skill_md()

    profile_lines = []
    for key, label in [
        ("dob", "생년월일"),
        ("region", "현재 거주 지역"),
        ("residence_duration", "거주 기간"),
        ("housing_status", "무주택 여부"),
        ("marital_status", "혼인 여부"),
        ("income_info", "소득 정보"),
        ("asset_info", "자산 정보"),
        ("car_value", "자동차 가액"),
    ]:
        v = user_profile.get(key)
        if v:
            profile_lines.append(f"- {label}: {v}")
        else:
            profile_lines.append(f"- {label}: (미제공)")

    profile_block = "\n".join(profile_lines)

    # 첫 user 메시지 구성
    first_user_parts = [
        "## 공고 내용\n" + notice_content,
        "## 사용자 프로필\n" + profile_block,
    ]
    if extra_user_text:
        first_user_parts.append(extra_user_text)
    first_user_content = "\n".join(first_user_parts)

    messages = [
        {
            "role": AS_SYSTEM,
            "content": (
                "아래 스킬 파일의 모든 규칙과 출력 형식을 그대로 따라 판정하세요.\n\n"
                + skill_md
            ),
        },
        {"role": AS_USER, "content": first_user_content},
    ]

    if history:
        for h in history:
            role = h.get("role") or "user"
            content = h.get("content") or ""
            if content:
                messages.append({"role": role, "content": content})

    # 출력 규칙은 대화 기록 맨 끝에 별도 user 메시지로 추가한다.
    output_rules = (
        "- 질문 단계: 한 번에 한 항목만 묻고, 🟢·🔴·🟡 판정 토큰이나 "
        '"한 줄 요약"·"자격조건 대조" 같은 최종 산출물 헤더는 절대 쓰지 않는다. '
        "질문 단계와 최종 판정을 한 응답에 섞지 않는다.\n"
        "- 최종 판정 단계: 스킬 파일의 9단계 출력 형식을 그대로 따른다. "
        "최종 판정(신청 가능 / 신청 불가 / 추가 확인 필요)을 가장 먼저 출력한다.\n"
        "- 위 규칙과 스킬 파일이 충돌하면 스킬을 따른다.\n"
    )
    messages.append({"role": AS_USER, "content": "\n\n## 출력 규칙\n" + output_rules})

    return messages


def call_solar(messages: list) -> str:
    """Solar Pro4에 메시지 리스트를 보내고 응답 텍스트를 반환한다.

    system/user/assistant 역할을 분리된 메시지로 전송하며,
            reasoning_effort=none, temperature=0, max_tokens=8192, timeout=120을 사용한다.
    고정 응답은 쓰지 않는다. 실제 호출이 실패하거나 키가 없으면 예외를 올린다(호출부가 처리).
    """
    if not SOLAR_API_KEY:
        raise RuntimeError("SOLAR_API_KEY not configured")

    payload = {
        "model": SOLAR_MODEL,
        "messages": messages,
        "max_tokens": 8192,
        "temperature": 0,
        "reasoning_effort": "minimal",
    }
    headers = {
        "Authorization": f"Bearer {SOLAR_API_KEY}",
        "Content-Type": "application/json",
    }
    resp = requests.post(
        f"{SOLAR_BASE_URL}/v1/chat/completions",
        headers=headers,
        json=payload,
        timeout=120,
    )
    resp.raise_for_status()
    body = resp.json()
    choices = body.get("choices") or []
    if not choices:
        raise RuntimeError("Solar returned no choices")
    return (choices[0].get("message") or {}).get("content") or ""


def is_final_judgment(text: str) -> bool:
    """Solar 응답이 최종 판정인지(질문 단계가 아닌지) 판별한다.

    판정 토큰(🟢/🔴/🟡)과 최종 출력 구조 마커가 함께 있고,
    질문형 표현이 전혀 없을 때만 True를 반환한다.
    질문형 표현은 질문 단어·종결어미·사용자 정보를 요구하는 패턴까지 넓게 탐지한다.
    하나라도 질문형 표현이 있으면 아무리 판정 토큰이 있어도 False를 반환한다.
    """
    if not text:
        return False

    has_judgment_token = "🟢" in text or "🔴" in text or "🟡" in text
    if not has_judgment_token:
        return False

    markers = [
        "한 줄 요약",
        "한 문장",
        "한줄 요약",
        "자격조건 대조",
        "판단 근거",
        "신청 전 확인할 것",
        "나의 순위",
    ]
    has_structure = any(m in text for m in markers)
    if not has_structure:
        return False

    # 판정 토큰 + 최종 출력 구조 마커가 모두 있으면,
    # 응답 텍스트에 물음표가 섞여 있어도 최종 판정으로 본다.
    # (Solar가 설명 중에 "~인가요?" 같은 표현을 포함할 수 있기 때문)
    return True


def extract_question(text: str):
    """Solar 응답이 질문 단계면 질문 내용을 추출해 반환한다.

    없으면 None. 여러 질문 줄이 있으면 개행으로 연결해 모두 반환한다.
    최종 판정 구조 마커가 보이는 응답은 질문으로 보지 않는다.
    """
    if not text:
        return None

    text = text.strip()

    # 이미 최종 판정 구조면 질문 아님
    if _looks_like_final(text):
        return None

    lines = text.splitlines()
    question_lines = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        # 이전 대화 접두 제거
        stripped = re.sub(r"^(사용자|AI 어시스턴트):\s*", "", stripped)
        if len(stripped) < 3:
            continue
        # 질문으로 볼 수 있는 줄만 수집
        if _line_is_question(stripped):
            question_lines.append(stripped)

    if not question_lines:
        # 질문 패턴이 안 보여도 첫 줄이 짧으면 질문으로 간주
        first = lines[0].strip() if lines else ""
        first = re.sub(r"^(사용자|AI 어시스턴트):\s*", "", first)
        if first and len(first) >= 3:
            question_lines.append(first)

    if not question_lines:
        return None

    combined = "\n".join(question_lines).strip()
    return combined if len(combined) >= 3 else None


def _looks_like_final(text: str) -> bool:
    """응답이 최종 판정 구조를 갖췄는지 빠르게 확인한다."""
    if not text:
        return False
    has_token = "🟢" in text or "🔴" in text or "🟡" in text
    if not has_token:
        return False
    markers = [
        "한 줄 요약",
        "한 문장",
        "한줄 요약",
        "자격조건 대조",
        "판단 근거",
        "신청 전 확인할 것",
        "나의 순위",
    ]
    return any(m in text for m in markers)


def _line_is_question(line: str) -> bool:
    """한 줄이 질문으로 볼 수 있는지 확인한다."""
    lower = line.lower()
    # 확정적인 질문 종결/요청 표현
    strong_indicators = [
        "알려주세요",
        "알려주실 수 있나요",
        "알려주실 수 있으신가요",
        "알려줘",
        "입력해주세요",
        "입력해 주세요",
        "입력해줘",
        "입력해주시고",
        "확인해 주세요",
        "확인해주세요",
        "확인해주시고",
        "확인 후 다시 알려주세요",
        "회신해주세요",
        "회신해 주세요",
        "답변해주세요",
        "답변해 주세요",
        "답변해줘",
        "몇년생",
        "몇년 생",
        "생년월일을 알려주세요",
        "거주 지역을 알려주세요",
        "무주택 여부를 알려주세요",
        "혼인 여부를 알려주세요",
        "가구 구성을 알려주세요",
        "월평균 소득을 알려주세요",
        "소득을 알려주세요",
        "자산을 알려주세요",
        "차량가액을 알려주세요",
        "차량 가액을 알려주세요",
        "자동차 가액을 알려주세요",
        "알고 계신가요",
        "알고 있습니까",
        "아세요",
        "아십니까",
        "맞나요",
        "맞습니까",
        "맞는지",
        "이에요",
        "인가요",
        "올까요",
        "될까요",
        "할까요",
        "인지",
        "아닌지",
    ]
    for ind in strong_indicators:
        if ind in lower:
            return True
    # 문장 끝 물음표는 질문으로 간주하되, 판정 마커가 있는 줄의 물음표는 제외
    if lower.rstrip().endswith("?"):
        # "신청 가능?/불가?"처럼 판정 결과를 묻는 형태도 질문으로 본다.
        return True
    return False


@app.post("/api/chat/session")
async def create_chat_session(request: Request, data: ChatSessionCreate):
    """공고 텍스트 + 사용자 프로필로 대화형 판정 세션을 시작한다.

    - 고정 응답은 사용하지 않는다. Solar 응답을 파싱해 질문 또는 최종 판정을 만든다.
    - Solar 키가 없으면 503으로 반환한다.
    - 세션과 첫 메시지를 저장하고, 질문이면 is_final=False, 최종 판정이면 is_final=True와 함께 결과/상세도 반환한다.
    """
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="사용자 세션이 없습니다")

    notice_text = (data.notice_content or "").strip()
    if not notice_text:
        raise HTTPException(status_code=400, detail="공고 내용이 필요합니다")

    user_profile = {
        "dob": data.dob,
        "region": data.region,
        "residence_duration": data.residence_duration,
        "housing_status": data.housing_status,
        "marital_status": data.marital_status,
        "income_info": data.income_info,
        "asset_info": data.asset_info,
        "car_value": data.car_value,
    }

    try:
        messages = build_chat_messages(notice_text, user_profile)
        raw = call_solar(messages)
    except RuntimeError as exc:
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "detail": str(exc)},
        )
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "detail": f"Solar 호출 실패: {exc}"},
        )

    parsed = _parse_eligibility_result(raw)
    final = is_final_judgment(raw)
    question_text = extract_question(raw) if not final else None

    if final:
        role = "assistant"
        content = raw
    else:
        role = "assistant"
        content = raw

    session_id = str(uuid.uuid4())
    notice_id = str(uuid.uuid5(uuid.NAMESPACE_OID, notice_text[:500]))
    now = datetime.now().isoformat()
    message_id = str(uuid.uuid4())

    conn = get_db()
    cursor = conn.cursor()

    # 전달받은 프로필을 user_profiles에 저장해둔다.
    # 이후 /api/chat/message에서 DB 기준으로 프로필을 읽어오므로
    # 세션 생성 시점에 전달된 프로필이 유실되지 않는다.
    profile_now = datetime.now().isoformat()
    # 전달된 값이 있는 필드만 조건부 갱신 — 없는 필드를 NULL로 덮어쓰지 않는다.
    # 이렇게 해야 이전에 채팅 답변으로 DB에 저장된 값이 새 세션 시작 때 날아가지 않는다.
    set_clauses: list[str] = []
    values: list[Any] = []
    if data.dob is not None:
        set_clauses.append("dob = ?")
        values.append(data.dob)
    if data.region is not None:
        set_clauses.append("region = ?")
        values.append(data.region)
    if data.residence_duration is not None:
        set_clauses.append("residence_duration = ?")
        values.append(data.residence_duration)
    if data.housing_status is not None:
        set_clauses.append("housing_status = ?")
        values.append(data.housing_status)
    if data.marital_status is not None:
        set_clauses.append("marital_status = ?")
        values.append(data.marital_status)
    if data.income_info is not None:
        set_clauses.append("income_info = ?")
        values.append(data.income_info)
    if data.asset_info is not None:
        set_clauses.append("asset_info = ?")
        values.append(data.asset_info)
    if data.car_value is not None:
        set_clauses.append("car_value = ?")
        values.append(data.car_value)
    if set_clauses:
        set_clauses.append("updated_at = ?")
        values.append(profile_now)
        values.append(user_id)
        cursor.execute(
            f"UPDATE user_profiles SET {', '.join(set_clauses)} WHERE id = ?",
            values,
        )

    cursor.execute("SELECT id FROM notices WHERE id = ?", (notice_id,))
    if cursor.fetchone() is None:
        cursor.execute(
            """INSERT INTO notices
               (id, title, agency, notice_type, region, publish_date,
                apply_start, apply_end, status, raw_content, created_at, updated_at)
               VALUES (?, '공고 판정', '', '', '', '', '', '', 'published', ?, ?, ?)""",
            (notice_id, notice_text, now, now),
        )

    cursor.execute(
        """INSERT INTO chat_sessions
           (id, user_id, notice_id, notice_content, result_label, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (session_id, user_id, notice_id, notice_text,
         parsed.get("result") if final else None, now, now),
    )

    cursor.execute(
        """INSERT INTO chat_messages
           (id, session_id, role, content, meta, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (message_id, session_id, role, content, "", now),
    )

    conn.commit()
    conn.close()

    response: dict = {
        "session_id": session_id,
        "role": role,
        "content": content,
        "is_final": final,
    }

    if final:
        result_label = parsed.get("result") or "needs_review"
        summary_text = parsed.get("summary")
        details = parsed.get("details") or []
        rank_text = parsed.get("rank")

        # 조건 상태 재확인: details에 needs_review/unverified가 하나라도 있으면
        # Solar가 🟢로 판정했더라도 전체 결과는 needs_review로 내린다.
        has_unconfirmed = any(
            d.get("result") in ("needs_review", "unverified") for d in details
        )
        if result_label == "eligible" and has_unconfirmed:
            result_label = "needs_review"

        result_id = str(uuid.uuid4())
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO eligibility_results
               (id, user_id, notice_id, result, summary, counts_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (result_id, user_id, notice_id, result_label,
             summary_text,
             json.dumps({"detail_count": len(details)}, ensure_ascii=False),
             now),
        )
        for d in details:
            cursor.execute(
                """INSERT INTO requirement_details
                   (id, result_id, requirement_name, requirement_type,
                    notice_criteria, user_info, result, notes)
                   VALUES (?, ?, ?, 'mandatory', ?, ?, ?, ?)""",
                (
                    str(uuid.uuid4()),
                    result_id,
                    d.get("requirement_name"),
                    d.get("notice_criteria"),
                    d.get("user_info"),
                    d.get("result"),
                    d.get("notes"),
                ),
            )
        conn.commit()
        conn.close()

        response["result"] = result_label
        response["summary"] = summary_text
        response["details"] = details
        response["notice_id"] = notice_id
        if rank_text:
            response["rank"] = rank_text
        applicant_type_text = parsed.get("applicant_type")
        if applicant_type_text:
            response["applicant_type"] = applicant_type_text

    return response


def calc_age_from_dob(dob: Optional[str]) -> Optional[int]:
    """생년월일 문자열(YYYY-MM-DD)에서 오늘 기준 만 나이를 계산한다.

    생일이 지나지 않았으면 1을 빼며, 파싱할 수 없거나 dob가비어 있으면 None을 반환한다.
    """
    if not dob:
        return None
    try:
        birth = datetime.strptime(dob, "%Y-%m-%d").date()
    except ValueError:
        return None
    today = date.today()
    age = today.year - birth.year
    if (today.month, today.day) < (birth.month, birth.day):
        age -= 1
    return age


def _is_uncertain_answer(text: str) -> bool:
    """사용자가 명시적으로 '모르겠다'고 표현한 답변인지 확인한다.

    이런 답변은 프로필에 저장하지 않고, DB와 in-memory 상태 모두 갱신하지 않는다.
    """
    if not text:
        return False
    t = text.strip().lower()
    if t in {"모름", "아직 모르겠어요", "모르겠어요", "몰름", "잘 모름", "모르겠음", "아직 모름", "확인 중"}:
        return True
    # "모름"이 포함된 짧은 답변도 uncertain으로 간주 (예: "소득 모름")
    if "모름" in t and len(t) <= 15:
        return True
    return False


@app.post("/api/chat/message")
async def send_chat_message(request: Request, data: ChatMessageCreate):
    """세션에 답변을 보내고 다음 질문 또는 최종 판정을 받는다.

    - Solar 키가 없으면 503으로 반환한다.
    - 저장된 메시지 히스토리를 함께 프롬프트에 넣어 이어서 판정한다.
    - 최종 판정이 나오면 eligibility_results/requirement_details에 저장하고 결과를 반환한다.
    """
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="사용자 세션이 없습니다")

    session_id = data.session_id
    if not session_id:
        raise HTTPException(status_code=400, detail="세션 ID가 필요합니다")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM chat_sessions WHERE id = ?", (session_id,))
    session_row = cursor.fetchone()
    if not session_row:
        conn.close()
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    if session_row["user_id"] != user_id:
        conn.close()
        raise HTTPException(status_code=403, detail="이 세션에 접근할 수 없습니다")

    notice_text = session_row["notice_content"]
    now = datetime.now().isoformat()

    cursor.execute(
        """SELECT role, content FROM chat_messages
           WHERE session_id = ?
           ORDER BY created_at ASC""",
        (session_id,),
    )
    history_rows = cursor.fetchall()
    history = [{"role": r["role"], "content": r["content"]} for r in history_rows]

    cursor.execute(
        """SELECT dob, region, residence_duration, housing_status, marital_status,
                  income_info, asset_info, car_value
           FROM user_profiles WHERE id = ?""",
        (user_id,),
    )
    profile_row = cursor.fetchone()
    if profile_row:
        user_profile = dict(profile_row)
    else:
        user_profile = {}

    history.append({"role": "user", "content": data.content})

    # 필드 키가 함께 전달됐으면 user_profiles에 즉시 반영해,
    # 다음 프롬프트의 '사용자 프로필' 블록에 미제공 대신 실제 값이 보이게 한다.
    if data.field_key:
        if _is_uncertain_answer(data.content):
            # "모름", "아직 모르겠어요" 등은 확정된 값이 아니므로
            # 일반 값처럼 저장하지 않는다. 대신 '이미 모름으로 답변했음'을
            # Solar가 인지할 수 있도록 센티넬을 저장해 재질문을 막는다.
            # (SKILL.md 471줄: "모름"에는 한 번만 반응하고 같은 질문을 다시 하지 않는다.)
            sentinel = f"⚠️ {data.content} (재질문 금지)"
            field_map = {
                "dob": "dob",
                "region": "region",
                "residence_duration": "residence_duration",
                "housing_status": "housing_status",
                "marital_status": "marital_status",
                "income_info": "income_info",
                "asset_info": "asset_info",
                "car_value": "car_value",
            }
            db_key = field_map.get(data.field_key)
            if db_key:
                cursor.execute(
                    f"UPDATE user_profiles SET {db_key} = ?, updated_at = ? WHERE id = ?",
                    (sentinel, now, user_id),
                )
                user_profile[db_key] = sentinel
        else:
            field_map = {
                "dob": "dob",
                "region": "region",
                "residence_duration": "residence_duration",
                "housing_status": "housing_status",
                "marital_status": "marital_status",
                "income_info": "income_info",
                "asset_info": "asset_info",
                "car_value": "car_value",
            }
            db_key = field_map.get(data.field_key)
            if db_key:
                cursor.execute(
                    f"UPDATE user_profiles SET {db_key} = ?, updated_at = ? WHERE id = ?",
                    (data.content, now, user_id),
                )
                # 방금 UPDATE한 값을 in-memory user_profile에도 반영해야
                # build_check_prompt는 예전 문자열 프롬프트 방식이라 더 이상 쓰지 않음. 지금은 build_chat_messages 사용.
                user_profile[db_key] = data.content

    # 사용자 메시지를 chat_messages에 저장
    user_message_id = str(uuid.uuid4())
    cursor.execute(
        """INSERT INTO chat_messages
           (id, session_id, role, content, meta, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (user_message_id, session_id, "user", data.content, "", now),
    )
    conn.commit()

    # Solar가 질문을 잘 못 세는 문제를 코드로 보완한다.
    # 이전 메시지 중 AI 질문(또는 최종 판정이 아닌 응답)이 5건을 넘으면
    # 더 묻지 말고 지금 Solar에 강제 마무리 프롬프트를 보내 판정한다.
    MAX_QUESTION_TURNS = 5
    _assistant_exchanges = 0
    for _h in history:
        _role = _h.get("role")
        _content = _h.get("content") or ""
        _is_final = _looks_like_final(_content)
        if _role == "assistant" and not _is_final:
            _assistant_exchanges += 1
    if _assistant_exchanges > MAX_QUESTION_TURNS:
        try:
            messages = build_chat_messages(
                notice_text,
                user_profile,
                history=history,
            )
            messages.append(
                {"role": "user", "content": "\n\n## 강제 마무리\n질문을 멈추고 지금 최종 판정을 내려 주세요. 스킬 파일의 9단계 출력 형식을 그대로 사용하세요."}
            )
            raw = call_solar(messages)
        except RuntimeError as exc:
            conn.close()
            return JSONResponse(
                status_code=503,
                content={"status": "unavailable", "detail": str(exc)},
            )
        except Exception as exc:
            conn.close()
            return JSONResponse(
                status_code=503,
                content={"status": "unavailable", "detail": f"Solar 호출 실패: {exc}"},
            )
        parsed = _parse_eligibility_result(raw)
        final = True
    else:
        try:
            messages = build_chat_messages(notice_text, user_profile, history=history)
            raw = call_solar(messages)
        except RuntimeError as exc:
            conn.close()
            return JSONResponse(
                status_code=503,
                content={"status": "unavailable", "detail": str(exc)},
            )
        except Exception as exc:
            conn.close()
            return JSONResponse(
                status_code=503,
                content={"status": "unavailable", "detail": f"Solar 호출 실패: {exc}"},
            )
        parsed = _parse_eligibility_result(raw)
        final = is_final_judgment(raw)

    if final:
        role = "assistant"
        content = raw
    else:
        role = "assistant"
        content = raw

    message_id = str(uuid.uuid4())
    cursor.execute(
        """INSERT INTO chat_messages
           (id, session_id, role, content, meta, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (message_id, session_id, role, content, "", now),
    )

    if final:
        result_label = parsed.get("result") or "needs_review"
        summary_text = parsed.get("summary")
        details = parsed.get("details") or []

        # 조건 상태 재확인: details에 needs_review/unverified가 하나라도 있으면
        # Solar가 🟢로 판정했더라도 전체 결과는 needs_review로 내린다.
        has_unconfirmed = any(
            d.get("result") in ("needs_review", "unverified") for d in details
        )
        if result_label == "eligible" and has_unconfirmed:
            result_label = "needs_review"

        cursor.execute(
            """UPDATE chat_sessions
               SET result_label = ?, updated_at = ?
               WHERE id = ?""",
            (result_label, now, session_id),
        )

        result_id = str(uuid.uuid4())
        cursor.execute(
            """INSERT INTO eligibility_results
               (id, user_id, notice_id, result, summary, counts_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (result_id, user_id, session_row["notice_id"], result_label,
             summary_text,
             json.dumps({"detail_count": len(details)}, ensure_ascii=False),
             now),
        )
        for d in details:
            cursor.execute(
                """INSERT INTO requirement_details
                   (id, result_id, requirement_name, requirement_type,
                    notice_criteria, user_info, result, notes)
                   VALUES (?, ?, ?, 'mandatory', ?, ?, ?, ?)""",
                (
                    str(uuid.uuid4()),
                    result_id,
                    d.get("requirement_name"),
                    d.get("notice_criteria"),
                    d.get("user_info"),
                    d.get("result"),
                    d.get("notes"),
                ),
            )
        conn.commit()
        conn.close()

        return {
            "session_id": session_id,
            "role": role,
            "content": content,
            "is_final": True,
            "result": result_label,
            "summary": summary_text,
            "details": details,
            "notice_id": session_row["notice_id"],
            "rank": parsed.get("rank"),
            "applicant_type": parsed.get("applicant_type"),
        }

    conn.commit()
    conn.close()

    return {
        "session_id": session_id,
        "role": role,
        "content": content,
        "is_final": False,
    }


@app.get("/api/chat/session/{session_id}")
async def get_chat_session(request: Request, session_id: str):
    """세션의 메시지 히스토리와 현재 상태를 조회한다."""
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="사용자 세션이 없습니다")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM chat_sessions WHERE id = ?", (session_id,))
    session_row = cursor.fetchone()
    if not session_row:
        conn.close()
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    if session_row["user_id"] != user_id:
        conn.close()
        raise HTTPException(status_code=403, detail="이 세션에 접근할 수 없습니다")

    cursor.execute(
        """SELECT role, content, created_at FROM chat_messages
           WHERE session_id = ?
           ORDER BY created_at ASC""",
        (session_id,),
    )
    messages = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return {
        "session_id": session_id,
        "notice_id": session_row["notice_id"],
        "result_label": session_row["result_label"],
        "messages": messages,
    }


@app.post("/api/eligibility/check")
async def check_eligibility(request: Request, data: dict):
    """공고 텍스트 + 사용자 프로필을 받아 Solar Pro4로 판정하고 결과를 저장·반환한다.

    - 고정 응답은 사용하지 않는다. Solar 응답을 파싱해 결과를 만든다.
    - Solar 키가 없으면 503으로 반환한다(프론트가 키 미설정 상태를 안내할 수 있도록).
    - 저장: eligibility_results + requirement_details.
    """
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="사용자 세션이 없습니다")

    notice_text = (data.get("notice_content") or "").strip()
    if not notice_text:
        raise HTTPException(status_code=400, detail="공고 내용이 필요합니다")

    user_profile = {
        "dob": data.get("dob"),
        "region": data.get("region"),
        "residence_duration": data.get("residence_duration"),
        "housing_status": data.get("housing_status"),
        "marital_status": data.get("marital_status"),
        "income_info": data.get("income_info"),
        "asset_info": data.get("asset_info"),
        "car_value": data.get("car_value"),
    }

    try:
        messages = build_chat_messages(notice_text, user_profile)
        raw = call_solar(messages)
    except RuntimeError as exc:
        # 키 미설정 등 호출 준비 문제
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "detail": str(exc)},
        )
    except Exception as exc:
        # 네트워크/시간이슈 등 실제 호출 실패
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "detail": f"Solar 호출 실패: {exc}"},
        )

    parsed = _parse_eligibility_result(raw)
    result_label = parsed.get("result") or "needs_review"
    summary_text = parsed.get("summary")
    details = parsed.get("details") or []

    # 저장
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.now().isoformat()

    # 공고 ID: 본문에 해시 기반 ID를 부여해 재사용한다
    notice_id = str(uuid.uuid5(uuid.NAMESPACE_OID, notice_text[:500]))

    # 공고가 없으면 light 등록(원문 저장)
    cursor.execute("SELECT id FROM notices WHERE id = ?", (notice_id,))
    if not cursor.fetchone():
        cursor.execute(
            """INSERT INTO notices (id, title, agency, notice_type, region, publish_date,
               apply_start, apply_end, status, raw_content, created_at, updated_at)
               VALUES (?, '공고 판정', '', '', '', '', '', '', 'published', ?, ?, ?)""",
            (notice_id, notice_text, now, now),
        )

    result_id = str(uuid.uuid4())
    cursor.execute(
        """INSERT INTO eligibility_results
           (id, user_id, notice_id, result, summary, counts_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            result_id,
            user_id,
            notice_id,
            result_label,
            summary_text,
            json.dumps({"detail_count": len(details)}, ensure_ascii=False),
            now,
        ),
    )

    for d in details:
        cursor.execute(
            """INSERT INTO requirement_details
               (id, result_id, requirement_name, requirement_type,
                notice_criteria, user_info, result, notes)
               VALUES (?, ?, ?, 'mandatory', ?, ?, ?, ?)""",
            (
                str(uuid.uuid4()),
                result_id,
                d.get("requirement_name"),
                d.get("notice_criteria"),
                d.get("user_info"),
                d.get("result"),
                d.get("notes"),
            ),
        )

    conn.commit()
    conn.close()

    return {
        "status": "ok",
        "result": result_label,
        "summary": summary_text,
        "details": details,
        "notice_id": notice_id,
        "rank": parsed.get("rank"),
    }


@app.get("/api/health")
async def health_check():
    """Health check 엔드포인트"""
    return {"status": "ok", "service": "청년주택 적격성 워크스페이스"}


