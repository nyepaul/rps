import re
from datetime import datetime


INCIDENT_EMAIL_SAMPLE = """
nyepaul/rps - 1 internal incident detected
Inbox

GitGuardian Team <support@gitguardian.com>
6:19 PM (54 minutes ago)
to me

gg-logo
1 internal secret incident detected!
Generic Password

2026-02-13 12:19:22 AM (UTC)

See on GitGuardian
github-icon-icon nyepaul/rps (commit a4fcca4)

See on GitHub
github-icon-icon nyepaul/rps (commit a4fcca4)

See on GitHub
""".strip()


def test_gitguardian_incident_sample_has_expected_core_fields():
    text = INCIDENT_EMAIL_SAMPLE

    incident_match = re.search(r"(\d+)\s+internal secret incident detected!", text)
    assert incident_match, "Incident count line missing"
    assert int(incident_match.group(1)) == 1

    detector_match = re.search(r"\n(Generic Password)\n", text)
    assert detector_match, "Detector label missing"
    assert detector_match.group(1) == "Generic Password"

    repo_match = re.search(r"\b([a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+)\s+\(commit\s+([0-9a-f]{7,40})\)", text)
    assert repo_match, "Repo/commit reference missing"
    assert repo_match.group(1) == "nyepaul/rps"
    assert repo_match.group(2) == "a4fcca4"


def test_gitguardian_incident_sample_timestamp_is_valid_utc_format():
    text = INCIDENT_EMAIL_SAMPLE
    ts_match = re.search(r"(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+[AP]M)\s+\(UTC\)", text)
    assert ts_match, "UTC timestamp line missing"
    parsed = datetime.strptime(ts_match.group(1), "%Y-%m-%d %I:%M:%S %p")
    assert parsed.year == 2026
    assert parsed.month == 2
    assert parsed.day == 13
