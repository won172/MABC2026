#!/usr/bin/env python3
"""
Ad-hoc verification for frontend onboarding page (Step 1 structure + build result).
Static HTML에는 현재 step만 렌더링되므로, Step 1 구조만 확인한다.
Step 전환은 브라우저 동작으로만 검증한다.
"""
import re
import sys
import urllib.request

ONBOARDING_URL = "http://localhost:3000/onboarding"

errors = []


def fetch(url):
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except Exception as e:
        return None, f"FETCH_ERROR: {e}"


def check(condition, msg):
    if not condition:
        errors.append(msg)


def main():
    print("FETCH /onboarding")
    status, payload = fetch(ONBOARDING_URL)
    check(status == 200, f"HTTP status {status} (expected 200)")

    if isinstance(payload, str) and payload.startswith("FETCH_ERROR"):
        print("Cannot fetch onboarding page:", payload)
        print("RESULT: FAIL (cannot fetch)")
        sys.exit(1)

    html = payload

    # Step 1 필드
    check('id="dob"' in html, "Step 1: dob input missing")
    check('id="region"' in html, "Step 1: region input missing")
    check('id="residence-duration"' in html, "Step 1: residence-duration input missing")

    # Step 1 라벨 (Next가 숫자 주변에 주석을 삽입하므로 유연하게 검사)
    step1_label_ok = (
        "Step" in html
        and "기본정보" in html
        and re.search(r"Step\s*<!--\s*-->\s*1\s*<!--\s*-->\s*/ 5\s*—\s*<!--\s*-->\s*기본정보", html)
        is not None
    ) or ("Step 1 / 5 — 기본정보" in html)
    check(step1_label_ok, "Step 1 label missing (Next 주석 포함 형태 아님)")

    # 스텝 표시기 5개
    step_indicators = re.findall(r'class="step-indicator[^"]*"', html)
    check(len(step_indicators) >= 5, f"step-indicator count {len(step_indicators)} (expected >= 5)")

    # 버튼
    check('btn-primary' in html, "다음/완료 버튼(missing btn-primary)")
    check('btn-ghost' in html, "이전 버튼(missing btn-ghost)")

    # 개인정보 안내문 (본문 하단)
    check("이 정보는 왜 받나요" in html, "개인정보 안내문(missing)")

    # 건너뛰기/나중에 버튼
    check("건너뛰기" in html, "건너뛰기 버튼(missing)")
    check("나중에" in html, "나중에 버튼(missing)")

    if errors:
        print("AD-HOC VERIFICATION: FAIL")
        for e in errors:
            print("  -", e)
        sys.exit(1)

    print("AD-HOC VERIFICATION: PASS (static HTML Step 1 structure)")
    print("  - HTTP 200")
    print("  - dob/region/residence-duration present")
    print("  - Step 1 label present")
    print("  - 5 step indicators present")
    print("  - 다음/이전/건너뛰기/나중에 buttons present")
    print("  - 개인정보 안내문 present")
    print("NOTE: step 전환(Step 1 -> 2 -> ... -> 5 -> /)은 브라우저 동작으로만 확인")


if __name__ == "__main__":
    main()
