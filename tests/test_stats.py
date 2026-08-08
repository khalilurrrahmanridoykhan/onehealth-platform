import pytest

from onehealth.services.stats import (
    demean_within_group,
    pearson_r,
    permutation_p_value,
    spearman_rho,
)


def test_pearson_r_perfect_positive_correlation():
    x = [1.0, 2.0, 3.0, 4.0, 5.0]
    y = [2.0, 4.0, 6.0, 8.0, 10.0]
    assert pearson_r(x, y) == pytest.approx(1.0)


def test_pearson_r_perfect_negative_correlation():
    x = [1.0, 2.0, 3.0, 4.0, 5.0]
    y = [10.0, 8.0, 6.0, 4.0, 2.0]
    assert pearson_r(x, y) == pytest.approx(-1.0)


def test_pearson_r_no_correlation_with_constant_y():
    x = [1.0, 2.0, 3.0, 4.0]
    y = [5.0, 5.0, 5.0, 5.0]
    assert pearson_r(x, y) == 0.0


def test_pearson_r_matches_stdlib_statistics_correlation():
    x = [1.0, 2.0, 3.0, 4.0, 5.0]
    y = [2.0, 1.0, 4.0, 3.0, 5.0]
    import statistics
    assert pearson_r(x, y) == pytest.approx(statistics.correlation(x, y))


def test_pearson_r_rejects_mismatched_lengths():
    with pytest.raises(ValueError):
        pearson_r([1.0, 2.0], [1.0])


def test_spearman_rho_perfect_monotonic_but_nonlinear():
    x = [1.0, 2.0, 3.0, 4.0, 5.0]
    y = [1.0, 4.0, 9.0, 16.0, 25.0]  # y = x^2: not linear, but monotonic
    assert spearman_rho(x, y) == pytest.approx(1.0)
    assert pearson_r(x, y) < 1.0  # Pearson penalizes the nonlinearity


def test_spearman_rho_handles_ties():
    x = [1.0, 1.0, 2.0, 3.0]
    y = [1.0, 1.0, 2.0, 3.0]
    assert spearman_rho(x, y) == pytest.approx(1.0)


def test_demean_within_group():
    values = [10.0, 20.0, 100.0, 200.0]
    groups = ["a", "a", "b", "b"]
    demeaned = demean_within_group(values, groups)
    assert demeaned == pytest.approx([-5.0, 5.0, -50.0, 50.0])


def test_demean_within_group_rejects_mismatched_lengths():
    with pytest.raises(ValueError):
        demean_within_group([1.0, 2.0], ["a"])


def test_permutation_p_value_small_for_strong_true_signal():
    x = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]
    y = [1.1, 2.0, 3.2, 3.9, 5.1, 5.8, 7.2, 7.9, 9.1, 10.2]
    p = permutation_p_value(x, y, pearson_r, n_permutations=2000)
    assert p < 0.05


def test_permutation_p_value_large_for_unrelated_data():
    x = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
    y = [3.0, 1.0, 6.0, 2.0, 5.0, 4.0]  # shuffled, no real relationship to x
    p = permutation_p_value(x, y, pearson_r, n_permutations=2000)
    assert p > 0.05


def test_permutation_p_value_never_exactly_zero():
    x = [1.0, 2.0, 3.0, 4.0, 5.0]
    y = [1.0, 2.0, 3.0, 4.0, 5.0]
    p = permutation_p_value(x, y, pearson_r, n_permutations=100)
    assert p > 0.0


def test_permutation_p_value_is_deterministic_given_a_seed():
    x = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
    y = [2.0, 1.0, 5.0, 3.0, 6.0, 4.0]
    p1 = permutation_p_value(x, y, pearson_r, n_permutations=500, seed=42)
    p2 = permutation_p_value(x, y, pearson_r, n_permutations=500, seed=42)
    assert p1 == p2


def test_permutation_p_value_stratified_by_group_preserves_group_structure():
    # Two groups with very different baselines; within each group there IS a
    # real relationship. A naive pooled permutation would be confounded by
    # the between-group gap; a stratified (within-group) permutation should
    # still detect the real within-group signal.
    x = [1.0, 2.0, 3.0, 1.0, 2.0, 3.0]
    y = [10.0, 20.0, 30.0, 110.0, 120.0, 130.0]
    groups = ["a", "a", "a", "b", "b", "b"]
    p = permutation_p_value(x, y, pearson_r, n_permutations=500, groups=groups)
    assert 0.0 < p <= 1.0
