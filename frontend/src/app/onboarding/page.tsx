'use client';

import { useState, useEffect, type FormEvent } from 'react';

type Step = 1 | 2 | 3 | 4 | 5;

interface Profile {
  dob: string;
  region: string;
  residenceDuration: string;
  housingStatus: 'yes' | 'no' | 'unknown' | '';
  maritalStatus: 'single' | 'married' | 'unknown' | '';
  incomeInfo: string;
  assetInfo: string;
  carValue: string;
}

const STEP_TITLES: Record<Step, string> = {
  1: '기본정보',
  2: '주거 상태',
  3: '가구·혼인',
  4: '소득·자산',
  5: '확인 및 완료',
};

const STEP_DESCRIPTIONS: Record<Step, string> = {
  1: '공고마다 사용하는 항목이 달라서, 필요한 정보만 차례로 물어봐요. 아직 모르는 값은 비워둘 수 있고, 입력을 멈춰도 지금까지 입력한 내용은 저장돼요.',
  2: '공고에서 무주택 여부를 확인할 때 필요해요. 확실하지 않으면 \'아직 모르겠어요\'를 선택할 수 있어요.',
  3: '공고에서 혼인 여부를 확인할 때 사용해요. 필요하지 않은 공고에서는 이 항목을 묻지 않아요.',
  4: '소득·자산·자동차 가액은 공고 기준으로 직접 확인한 값을 입력해요. 잘 모르면 \'모름\'이나 \'확인 중\'으로 둬도 돼요. 서비스가 대신 계산하거나 조회하지 않아요.',
  5: '지금까지 입력한 내용을 확인해요. 저장된 정보는 메인 화면의 프로필 편집에서 언제든 수정할 수 있어요.',
};

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [profile, setProfile] = useState<Profile>({
    dob: '',
    region: '',
    residenceDuration: '',
    housingStatus: '',
    maritalStatus: '',
    incomeInfo: '',
    assetInfo: '',
    carValue: '',
  });

  const update = (key: keyof Profile, value: string) =>
    setProfile((p) => ({ ...p, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (step < 5) {
      const saved = await saveProgress();
      if (saved) {
        setStep((s) => (Math.min(s + 1, 5) as Step));
      }
      return;
    }
    const saved = await saveProgress();
    if (saved) {
      window.location.href = '/';
    }
  };

  const saveProgress = async (): Promise<boolean> => {
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
      const res = await fetch(`${base}/api/onboarding/progress`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_step: step,
          dob: profile.dob,
          region: profile.region,
          residence_duration: profile.residenceDuration,
          housing_status: profile.housingStatus,
          marital_status: profile.maritalStatus,
          income_info: profile.incomeInfo,
          asset_info: profile.assetInfo,
          car_value: profile.carValue,
        }),
      });
      if (!res.ok) {
        return false;
      }
      const data = await res.json();
      return !!(data.id ?? data.user_id);
    } catch {
      return false;
    }
  };

  const skip = () => {
    window.location.href = '/';
  };

  const later = () => {
    window.location.href = '/';
  };

  const goPrev = () => {
    if (step > 1) {
      setStep((s) => (Math.max(s - 1, 1) as Step));
    }
  };

  // 마운트 시 현재 진행 상황 복원
  useEffect(() => {
    let cancelled = false;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
    fetch(`${base}/api/onboarding/progress`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const n = (data.current_step ?? 1) as Step;
        setStep(n);
        if (data.dob) setProfile((p) => ({ ...p, dob: data.dob }));
        if (data.region) setProfile((p) => ({ ...p, region: data.region }));
        if (data.residence_duration) setProfile((p) => ({ ...p, residenceDuration: data.residence_duration }));
        if (data.housing_status) setProfile((p) => ({ ...p, housingStatus: data.housing_status }));
        if (data.marital_status) setProfile((p) => ({ ...p, maritalStatus: data.marital_status }));
        if (data.income_info) setProfile((p) => ({ ...p, incomeInfo: data.income_info }));
        if (data.asset_info) setProfile((p) => ({ ...p, assetInfo: data.asset_info }));
        if (data.car_value) setProfile((p) => ({ ...p, carValue: data.car_value }));
      })
      .catch(() => {
        // 백엔드 미연결 상태에서도 프론트 렌더링은 유지
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const steps: Step[] = [1, 2, 3, 4, 5];
  const housingStatusSelected = (v: Profile['housingStatus']) =>
    profile.housingStatus === v ? 'selected' : '';
  const maritalStatusSelected = (v: Profile['maritalStatus']) =>
    profile.maritalStatus === v ? 'selected' : '';

  return (
    <div className="min-h-screen bg-[#f7f8fa] flex flex-col">
      <header className="top-nav">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            Y
          </span>
          <span>청년주택 적격성 워크스페이스</span>
        </div>
        <div className="nav-actions">
          <button type="button" className="btn btn-link" onClick={skip}>
            건너뛰기
          </button>
          <button type="button" className="btn btn-secondary" onClick={later}>
            나중에
          </button>
        </div>
      </header>

      <main id="main" className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-10">
        <div className="onboarding-header">
          <div className="step-row" role="list" aria-label="진행 단계">
            {steps.map((s) => (
              <div key={s} className="step-item" role="listitem">
                <span
                  className={`step-indicator ${step >= s ? 'active' : ''}`}
                  aria-current={step === s ? 'step' : undefined}
                >
                  {s}
                </span>
                {s < 5 && (
                  <span
                    className={`step-track ${step > s ? 'done' : ''}`}
                    aria-hidden="true"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="step-label">
            Step {step} / 5 — {STEP_TITLES[step]}
          </div>
          <p className="step-description">{STEP_DESCRIPTIONS[step]}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {step === 1 && (
            <div className="fields">
              <div className="field">
                <label className="field-label" htmlFor="dob">
                  생년월일
                </label>
                <p className="field-hint" id="dob-hint">
                  만 나이 계산에 사용해요. 공고 기준일에 따라 판정 시점이 달라질 수 있어요.
                </p>
                <input
                  className="field-input"
                  id="dob"
                  type="date"
                  name="dob"
                  value={profile.dob}
                  onChange={(e) => update('dob', e.target.value)}
                  aria-describedby="dob-hint"
                  required
                />
                <p className="field-hint" style={{ marginTop: 6 }}>
                  예시: 1997년 4월생 → 만 29세 (공고일 기준)
                </p>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="region">
                  현재 거주 지역
                </label>
                <p className="field-hint">
                  시·도를 알려주시면, 지역별 조건이 있는 공고에서 확인할 수 있어요.
                </p>
                <input
                  className="field-input"
                  id="region"
                  type="text"
                  name="region"
                  value={profile.region}
                  onChange={(e) => update('region', e.target.value)}
                  placeholder="예: 서울특별시, 부산광역시"
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="residence-duration">
                  거주 기간
                </label>
                <p className="field-hint">
                  공고에서 거주기간을 요구할 때 사용해요. 단위는 자유롭게 입력할 수 있어요.
                </p>
                <input
                  className="field-input"
                  id="residence-duration"
                  type="text"
                  name="residence_duration"
                  value={profile.residenceDuration}
                  onChange={(e) =>
                    update('residenceDuration', e.target.value)
                  }
                  placeholder="예: 3년, 2년 4개월, 1년"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="field">
              <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend className="field-label">무주택 여부</legend>
                <p className="field-hint">
                  공고에서 세대 구성원 무주택 여부를 확인할 때 사용해요.
                </p>
                <div className="field-row" role="radiogroup" aria-label="무주택 여부">
                  <label className={`field-choice ${housingStatusSelected('yes')}`}>
                    <input
                      type="radio"
                      name="housing_status"
                      value="yes"
                      checked={profile.housingStatus === 'yes'}
                      onChange={() => update('housingStatus', 'yes')}
                    />
                    <span>무주택이에요</span>
                  </label>
                  <label className={`field-choice ${housingStatusSelected('no')}`}>
                    <input
                      type="radio"
                      name="housing_status"
                      value="no"
                      checked={profile.housingStatus === 'no'}
                      onChange={() => update('housingStatus', 'no')}
                    />
                    <span>주택이 있어요</span>
                  </label>
                  <label className={`field-choice ${housingStatusSelected('unknown')}`}>
                    <input
                      type="radio"
                      name="housing_status"
                      value="unknown"
                      checked={profile.housingStatus === 'unknown'}
                      onChange={() => update('housingStatus', 'unknown')}
                    />
                    <span>아직 모르겠어요</span>
                  </label>
                </div>
                <p className="unknown-note">
                  <strong>&ldquo;아직 모르겠어요&rdquo;</strong>를 선택하면, 공고에서 무주택 확인이 필요한 경우 나중에 다시 확인하도록 안내해요.
                  이 상태에서 신청이 무조건 불가하다고 단정하지 않아요.
                </p>
              </fieldset>
            </div>
          )}

          {step === 3 && (
            <div className="field">
              <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend className="field-label">혼인 여부</legend>
                <p className="field-hint">
                  공고에서 혼인 여부를 확인할 때 사용해요. 필요하지 않은 공고에서는 이 항목을 묻지 않아요.
                </p>
                <div className="field-row" role="radiogroup" aria-label="혼인 여부">
                  <label className={`field-choice ${maritalStatusSelected('single')}`}>
                    <input
                      type="radio"
                      name="marital_status"
                      value="single"
                      checked={profile.maritalStatus === 'single'}
                      onChange={() => update('maritalStatus', 'single')}
                    />
                    <span>미혼이에요</span>
                  </label>
                  <label className={`field-choice ${maritalStatusSelected('married')}`}>
                    <input
                      type="radio"
                      name="marital_status"
                      value="married"
                      checked={profile.maritalStatus === 'married'}
                      onChange={() => update('maritalStatus', 'married')}
                    />
                    <span>기혼이에요</span>
                  </label>
                  <label className={`field-choice ${maritalStatusSelected('unknown')}`}>
                    <input
                      type="radio"
                      name="marital_status"
                      value="unknown"
                      checked={profile.maritalStatus === 'unknown'}
                      onChange={() => update('maritalStatus', 'unknown')}
                    />
                    <span>아직 모르겠어요</span>
                  </label>
                </div>
              </fieldset>
            </div>
          )}

          {step === 4 && (
            <div className="fields">
              <div className="field">
                <label className="field-label" htmlFor="income_info">
                  월평균 소득
                </label>
                <p className="field-hint">
                  공고 기준으로 직접 확인한 값을 입력해요. 잘 모르면 &ldquo;모름&rdquo;이라고 입력해도 돼요.
                </p>
                <input
                  className="field-input"
                  id="income_info"
                  type="text"
                  name="income_info"
                  value={profile.incomeInfo}
                  onChange={(e) => update('incomeInfo', e.target.value)}
                  placeholder="예: 모름, 210만원, 확인 중"
                />
                <p className="field-hint" style={{ marginTop: 6 }}>
                  단순 월급·실수령액과 공고상 월평균소득은 다를 수 있어요.
                  공고 기준에 맞는 값인지 확인이 필요해요.
                </p>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="asset_info">
                  총자산
                </label>
                <p className="field-hint">
                  공고 기준으로 직접 확인한 값을 입력해요. 잘 모르면 &ldquo;모름&rdquo;이라고 입력해도 돼요.
                </p>
                <input
                  className="field-input"
                  id="asset_info"
                  type="text"
                  name="asset_info"
                  value={profile.assetInfo}
                  onChange={(e) => update('assetInfo', e.target.value)}
                  placeholder="예: 모름, 1억 2천만원, 확인 중"
                />
                <p className="field-hint" style={{ marginTop: 6 }}>
                  총자산 = 부동산 + 자동차 + 금융자산 + 기타자산 − 부채.
                  직접 확인 경로가 필요하면 &ldquo;모름&rdquo;으로 두고 넘어가도 돼요.
                </p>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="car_value">
                  자동차 가액
                </label>
                <p className="field-hint">
                  공고 기준으로 직접 확인한 값을 입력해요. 해당 없으면 &ldquo;없음&rdquo;, 잘 모르면 &ldquo;모름&rdquo;이라고 입력해도 돼요.
                </p>
                <input
                  className="field-input"
                  id="car_value"
                  type="text"
                  name="car_value"
                  value={profile.carValue}
                  onChange={(e) => update('carValue', e.target.value)}
                  placeholder="예: 모름, 없음, 1,500만원"
                />
                <p className="field-hint" style={{ marginTop: 6 }}>
                  자동차 가액은 기준가액(차량기준가액 / 시가표준액) 개념이에요.
                  보험개발원·카히스토리 또는 홈택스·손택스에서 확인할 수 있어요.
                </p>
              </div>

              <p className="privacy-note" style={{ marginTop: 'var(--space-lg)' }}>
                <strong>이 값들은 서비스가 대신 계산하거나 조회하지 않아요.</strong>
                소득·자산·자동차 가액은 사용자가 직접 확인한 값을 기준으로 판정해요.
                확인한 값이 공고 기준과 맞는지 본인이 최종 판단해야 해요.
              </p>
            </div>
          )}

          {step === 5 && (
            <div className="summary-card">
              <div className="summary-title">지금까지 입력한 내용</div>
              <div className="summary-grid">
                <div className="summary-item">
                  <div className="summary-item-label">생년월일</div>
                  <div className="summary-item-value">
                    {profile.dob || '입력 안 함'}
                  </div>
                </div>
                <div className="summary-item">
                  <div className="summary-item-label">거주 지역</div>
                  <div className="summary-item-value">
                    {profile.region || '입력 안 함'}
                  </div>
                </div>
                <div className="summary-item">
                  <div className="summary-item-label">거주 기간</div>
                  <div className="summary-item-value">
                    {profile.residenceDuration || '입력 안 함'}
                  </div>
                </div>
                <div className="summary-item">
                  <div className="summary-item-label">무주택 여부</div>
                  <div className="summary-item-value">
                    {profile.housingStatus
                      ? {
                          yes: '무주택이에요',
                          no: '주택이 있어요',
                          unknown: '아직 모르겠어요',
                        }[profile.housingStatus]
                      : '입력 안 함'}
                  </div>
                </div>
                <div className="summary-item">
                  <div className="summary-item-label">혼인 여부</div>
                  <div className="summary-item-value">
                    {profile.maritalStatus
                      ? {
                          single: '미혼이에요',
                          married: '기혼이에요',
                          unknown: '아직 모르겠어요',
                        }[profile.maritalStatus]
                      : '입력 안 함'}
                  </div>
                </div>
                <div className="summary-item">
                  <div className="summary-item-label">소득 (월평균)</div>
                  <div className="summary-item-value">
                    {profile.incomeInfo || '입력 안 함'}
                  </div>
                </div>
                <div className="summary-item">
                  <div className="summary-item-label">총자산</div>
                  <div className="summary-item-value">
                    {profile.assetInfo || '입력 안 함'}
                  </div>
                </div>
                <div className="summary-item">
                  <div className="summary-item-label">자동차 가액</div>
                  <div className="summary-item-value">
                    {profile.carValue || '입력 안 함'}
                  </div>
                </div>
              </div>
              <p className="summary-note">
                저장된 정보는 메인 화면의 <strong>프로필 편집</strong>에서 언제든 수정할 수
                있어요. 민감한 소득·자산·자동차 가액은 &ldquo;모름&rdquo;으로 둘 수 있고, 공고 판정 시점에 다시 물어볼 수 있어요.
              </p>
            </div>
          )}

          <input type="hidden" name="current_step" value={step} />

          <div className="onboarding-actions">
            <div className="left-actions">
              <label className="checkbox-note">
                {/* 알림 기능은 P1 — MVP에서는 UI만 남기고 백엔드 미연결 */}
                <input type="checkbox" name="notify_eligible" disabled />
                <span>나중에 다시 확인할 항목을 알림으로 받기</span>
              </label>
            </div>
            <div className="action-row">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={goPrev}
                disabled={step === 1}
              >
                이전
              </button>
              <button type="submit" className="btn btn-primary">
                {step === 5 ? '완료' : '다음'}
              </button>
            </div>
          </div>
        </form>

        <p className="privacy-note">
          <strong>이 정보는 왜 받나요?</strong> 공고마다 요구하는 조건이 달라서, 필요한
          항목만 확인하기 위해 저장해요. 저장된 정보는 언제든 수정할 수 있고, 민감한
          소득·자산·자동차 가액은 &ldquo;모름&rdquo;으로 둘 수 있어요. 서비스는 이 값을 대신
          계산하거나 조회하지 않으며, 직접 확인한 값이 공고 기준과 맞는지 본인이 최종
          판단해야 해요.
        </p>
      </main>
    </div>
  );
}
