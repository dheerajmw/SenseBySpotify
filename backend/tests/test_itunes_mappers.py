from app.services.itunes_mappers import map_itunes_track


def test_map_itunes_track_includes_primary_genre() -> None:
    track = map_itunes_track(
        {
            "trackId": 123,
            "trackName": "Test Song",
            "artistId": 456,
            "artistName": "Test Artist",
            "collectionId": 789,
            "collectionName": "Test Album",
            "primaryGenreName": "Pop",
            "trackTimeMillis": 180000,
            "previewUrl": "https://example.com/preview.m4a",
        },
    )

    assert track.primary_genre == "Pop"
    assert track.artists[0].genres == ["Pop"]


def test_map_itunes_track_without_genre() -> None:
    track = map_itunes_track(
        {
            "trackId": 123,
            "trackName": "Test Song",
            "artistName": "Test Artist",
        },
    )

    assert track.primary_genre is None
    assert track.artists[0].genres == []
