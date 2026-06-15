import unittest
from types import SimpleNamespace

import play_sound


class AdaptiveSoundClassificationTests(unittest.TestCase):
    def classify(self, event_name="commit", command="", message="", files=None, stats=None):
        return play_sound.classify_event(
            event_name,
            command,
            message,
            files or [],
            stats or {"files_changed": 0, "insertions": 0, "deletions": 0},
        )

    def test_docs_commit_is_tiny_win(self):
        analysis = self.classify(message="docs: update readme", files=["README.md"], stats={"files_changed": 1, "insertions": 2, "deletions": 0})
        self.assertEqual(analysis["profile"], "tiny_win")
        self.assertEqual(analysis["intent"], "docs")
        self.assertEqual(analysis["risk"], "low")

    def test_fix_commit_is_bug_fix(self):
        analysis = self.classify(message="fix crash in sidebar", files=["src/sidebar.js"], stats={"files_changed": 2, "insertions": 12, "deletions": 4})
        self.assertEqual(analysis["profile"], "bug_fix")
        self.assertEqual(analysis["intent"], "fix")

    def test_auth_payment_change_is_risky(self):
        analysis = self.classify(
            message="fix auth payment bug",
            files=["src/auth/login.js", "src/payment/checkout.js"],
            stats={"files_changed": 2, "insertions": 40, "deletions": 8},
        )
        self.assertEqual(analysis["profile"], "risky_change")
        self.assertEqual(analysis["risk"], "high")
        self.assertEqual(analysis["riskyFileCount"], 2)

    def test_push_is_deploy_win(self):
        analysis = self.classify(event_name="push", message="feat: add dashboard", files=["src/dashboard.js"], stats={"files_changed": 3, "insertions": 80, "deletions": 4})
        self.assertEqual(analysis["profile"], "deploy_win")
        self.assertEqual(analysis["intent"], "deploy")

    def test_tests_are_test_green(self):
        analysis = self.classify(message="test: add payment coverage", files=["tests/payment.test.py"], stats={"files_changed": 1, "insertions": 30, "deletions": 0})
        self.assertEqual(analysis["profile"], "test_green")
        self.assertEqual(analysis["testFileCount"], 1)

    def test_major_feature_is_major_release(self):
        analysis = self.classify(message="feat: initial launch", files=["src/app.js"], stats={"files_changed": 24, "insertions": 1400, "deletions": 20})
        self.assertEqual(analysis["profile"], "major_release")
        self.assertEqual(analysis["scale"], "major")

    def test_feedback_can_personalize_soft_profile(self):
        state = play_sound.default_state()
        state["profile_feedback"]["bug_fix"] = -2
        analysis = self.classify(message="fix sidebar issue", files=["src/sidebar.js"], stats={"files_changed": 1, "insertions": 4, "deletions": 1})
        play_sound.apply_personalization(analysis, state)
        self.assertEqual(analysis["baseProfile"], "bug_fix")
        self.assertEqual(analysis["profile"], "tiny_win")
        self.assertTrue(analysis["personalized"])

    def test_momentum_tracks_streak_and_today_count(self):
        state = play_sound.default_state()
        first = self.classify(message="docs: update readme", files=["README.md"])
        second = self.classify(message="fix sidebar issue", files=["src/sidebar.js"])
        play_sound.apply_momentum(first, state, "commit")
        play_sound.apply_momentum(second, state, "commit")
        self.assertEqual(second["streakCount"], 2)
        self.assertEqual(second["todayCount"], 2)
        self.assertEqual(second["momentumLabel"], "steady")

    def test_voice_summary_for_risky_change(self):
        analysis = self.classify(message="fix auth payment bug", files=["src/auth/login.js"], stats={"files_changed": 1, "insertions": 5, "deletions": 2})
        self.assertEqual(analysis["summary"], "Risky change completed.")

    def test_team_deploy_requires_enabled_webhook_and_deploy(self):
        deploy = self.classify(event_name="push", message="release dashboard", files=["src/dashboard.js"])
        args = SimpleNamespace(team_enabled="true", team_webhook_url="https://example.invalid/webhook")
        self.assertTrue(play_sound.should_send_team_deploy(args, deploy))

        args.team_enabled = "false"
        self.assertFalse(play_sound.should_send_team_deploy(args, deploy))


if __name__ == "__main__":
    unittest.main()
