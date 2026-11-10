---
id: heat-engines-real
title: Why real engines fall short
level: beginner
lang: en
goals:
  - Name the irreversibilities that keep a real engine below the Carnot limit
  - Judge an engine by comparing its efficiency with the limit
study: true
---

# Why real engines fall short

**Why it matters.** A claim that an engine reaches 70% efficiency can be checked in a minute. You need
[the Carnot limit](02-the-carnot-limit.md).

## Where the work goes

Every step of a real engine is a little irreversible, and each irreversibility loses some work it could have done.

- **Friction** between moving parts turns work into heat.
- **Heat across a temperature gap**: the hot gas never touches the reservoir at exactly its own temperature.
- **Speed**: a real engine runs fast, so the gas is never in a calm, uniform state.

A <mark data-tone="definition">second-law efficiency</mark> is the ratio of an engine's real efficiency to its Carnot
efficiency: how close it comes to the best it could do.

:::plot[How close an engine comes to its limit]
Move the real efficiency and see the share of the limit it reaches.
$$\epsilon = \frac{\eta}{1 - T_c / T_h}$$
- $T_h$ in [400, 1500] — hot reservoir (K)
- $T_c$ = 300 in [250, 350] — cold reservoir (K)
- $\eta$ = 0.3 in [0.1, 0.6] — real efficiency
:::

### Worked example: checking a claim

A start-up claims its engine reaches an efficiency of 0.70 between 500 K and 300 K.

1. The limit: $\eta_C = 1 - 300/500 = 0.40$.
2. The claim, 0.70, is above 0.40.
3. So <mark data-tone="example">the claim breaks the second law</mark>: no engine between those temperatures can do it.

:::warning
Don't <mark data-tone="trap">compare efficiencies across different temperatures</mark>. An engine at 0.35 between
1000 K and 300 K is further from its limit (0.70) than one at 0.30 between 500 K and 300 K (limit 0.40).
:::

## Practice

:::speed[True or false?]
- [x] A reversible engine sets the ceiling for every engine between the same two temperatures.
- [ ] An engine in a cycle can turn all its heat into work if it has no friction.
  > It must still give heat to the cold reservoir.
- [x] The Carnot formula needs temperatures in kelvin.
- [ ] Heat is a state function.
  > Heat depends on the path; internal energy is the state function.
:::

:::cloze
An engine runs between 900 K and 300 K with an efficiency of 0.40. Its Carnot limit is {{0.667}}, so it reaches {{0.6}} of it.
:::
