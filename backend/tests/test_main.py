from app import main


def test_active_data_directory_is_resolved_for_each_request(tmp_path, monkeypatch):
    example = tmp_path / "example_data"
    operational = tmp_path / "data"
    selections = iter(((example, "EXAMPLE"), (operational, "OPERATIONAL")))
    monkeypatch.setattr(main, "resolve_data_directory", lambda: next(selections))

    assert main.active_data_directory() == example
    assert main.active_data_directory() == operational
