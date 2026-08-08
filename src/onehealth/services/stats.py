"""Minimal, dependency-free statistics for exploratory correlation analysis.

No numpy/scipy: this project keeps a deliberately small dependency footprint
(see pyproject.toml). Significance is assessed by permutation test rather than
a parametric (t-distribution) approximation, which avoids relying on
normality assumptions that don't obviously hold for small, ecological-level
samples like the ones this module analyzes.
"""

import random
from statistics import mean, pstdev


def pearson_r(x: list[float], y: list[float]) -> float:
    if len(x) != len(y):
        raise ValueError("x and y must be the same length")
    if len(x) < 2:
        raise ValueError("pearson_r requires at least 2 observations")

    mean_x, mean_y = mean(x), mean(y)
    covariance = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y))
    std_x = pstdev(x)
    std_y = pstdev(y)
    if std_x == 0 or std_y == 0:
        return 0.0
    return covariance / (len(x) * std_x * std_y)


def _ranks(values: list[float]) -> list[float]:
    """Fractional (average) ranks, ties sharing the mean rank."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        average_rank = (i + j) / 2.0 + 1.0
        for k in range(i, j + 1):
            ranks[order[k]] = average_rank
        i = j + 1
    return ranks


def spearman_rho(x: list[float], y: list[float]) -> float:
    return pearson_r(_ranks(x), _ranks(y))


def permutation_p_value(
    x: list[float],
    y: list[float],
    statistic,
    *,
    n_permutations: int = 5000,
    seed: int = 20260807,
    groups: list[str] | None = None,
) -> float:
    """Two-sided permutation p-value for ``statistic(x, y)``.

    If ``groups`` is given (one label per observation), ``y`` is shuffled
    only within each group -- a stratified permutation appropriate for
    testing a within-group (e.g. within-division) relationship without
    breaking the between-group structure.
    """
    observed = abs(statistic(x, y))
    rng = random.Random(seed)
    y_work = list(y)

    if groups is not None:
        if len(groups) != len(y):
            raise ValueError("groups must be the same length as y")
        indices_by_group: dict[str, list[int]] = {}
        for index, group in enumerate(groups):
            indices_by_group.setdefault(group, []).append(index)
    else:
        indices_by_group = None

    at_least_as_extreme = 0
    for _ in range(n_permutations):
        if indices_by_group is not None:
            for indices in indices_by_group.values():
                values = [y_work[i] for i in indices]
                rng.shuffle(values)
                for i, value in zip(indices, values):
                    y_work[i] = value
        else:
            rng.shuffle(y_work)
        if abs(statistic(x, y_work)) >= observed:
            at_least_as_extreme += 1

    # Add-one correction: a permutation p-value is never exactly 0.
    return (at_least_as_extreme + 1) / (n_permutations + 1)


def demean_within_group(values: list[float], groups: list[str]) -> list[float]:
    """Subtract each group's own mean, isolating within-group variation."""
    if len(values) != len(groups):
        raise ValueError("values and groups must be the same length")
    group_values: dict[str, list[float]] = {}
    for value, group in zip(values, groups):
        group_values.setdefault(group, []).append(value)
    group_means = {group: mean(vals) for group, vals in group_values.items()}
    return [value - group_means[group] for value, group in zip(values, groups)]
