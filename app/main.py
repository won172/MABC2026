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
from datetime import datetime

app = FastAPI(
    title="청년주택 적격성 워크스페이스",
    description="공고 기반 청년주택 신청자격 판정 서비스",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 마운트
app.mount("/static", StaticFiles(directory="static"), name="static")

# 템플릿 설정
templates = Jinja2Templates(directory="templates")

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
            onboarding_step INTEGER DEFAULT 1,
            notify_eligible BOOLEAN DEFAULT 0
        )
    """)
    
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
    
    conn.commit()
    conn.close()

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
        return templates.TemplateResponse("index.html", {
            "request": request,
            "user_id": user_id,
            "notices": []
        })

    response = templates.TemplateResponse("onboarding.html", {
        "request": request,
        "current_step": row["onboarding_step"] if row else 1,
        "user_id": user_id,
        "profile": dict(row) if row else {},
        "step_title": step_titles.get(row["onboarding_step"] if row else 1, ""),
        "step_description": step_descriptions.get(row["onboarding_step"] if row else 1, ""),
        "housing_status_label": housing_status_label,
        "marital_status_label": marital_status_label,
    })
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
    cursor.execute("SELECT * FROM user_profiles WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    
    if not row:
        cursor.execute(
            "INSERT INTO user_profiles (id, created_at, updated_at, onboarding_step) VALUES (?, ?, ?, ?)",
            (user_id, datetime.now().isoformat(), datetime.now().isoformat(), step)
        )
        conn.commit()
    
    conn.close()

    response = templates.TemplateResponse(
        "onboarding.html",
        {
            "request": request,
            "current_step": step,
            "user_id": user_id,
            "profile": dict(row) if row else {},
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
    cursor.execute("""
        UPDATE user_profiles 
        SET dob = ?, region = ?, residence_duration = ?, 
            housing_status = ?, marital_status = ?, 
            income_info = ?, asset_info = ?, car_value = ?,
            notify_eligible = ?, onboarding_step = ?, updated_at = ?
        WHERE id = ?
    """, (
        data.dob, data.region, data.residence_duration,
        data.housing_status, data.marital_status,
        data.income_info, data.asset_info, data.car_value,
        int(data.notify_eligible),
        data.current_step or 2,
        now, user_id
    ))
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

@app.get("/api/notices")
async def list_notices(request: Request):
    """공고 목록 조회"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM notices WHERE status != 'deleted' ORDER BY publish_date DESC")
    rows = cursor.fetchall()
    conn.close()
    
    notices = [dict(row) for row in rows]
    return {"notices": notices}

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

@app.get("/api/health")
async def health_check():
    """Health check 엔드포인트"""
    return {"status": "ok", "service": "청년주택 적격성 워크스페이스"}
