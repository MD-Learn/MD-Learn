---
id: heat-engines-carnot
title: The Carnot limit
level: beginner
lang: en
goals:
  - Compute the Carnot efficiency from two temperatures in kelvin
  - Describe the four steps of the Carnot cycle
study: true
---

# The Carnot limit

**Why it matters.** Engineers can't make an engine better than a number set by two temperatures. Knowing that number
tells you when an improvement is still possible and when it is a dream. You need [the first law](01-energy-in-work-out.md).

## No engine beats a reversible one

:::quiz
Two engines work between the same hot and cold reservoirs. One is perfectly reversible. What can you say about the other?
- [ ] It can be more efficient if it is well designed.
  > No design beats the reversible engine between the same two temperatures.
- [x] It is at most as efficient as the reversible one.
  > Right: the reversible engine sets the ceiling for every engine.
- [ ] It must have the same efficiency as the reversible one.
  > Only another reversible engine reaches it; real ones fall below.
:::

A <mark data-tone="definition">reversible</mark> process is one that could be run backwards with no trace left on the
surroundings: no friction, no heat flowing across a temperature gap. It is an ideal, and the best you can do.

Why should the reversible engine be the best? Suppose some engine beat it. You could run the reversible engine
backwards as a heat pump, driven by the better engine's work, and the pair would move heat from cold to hot with nothing
else changing. That never happens, so no engine can beat the reversible one. The argument also shows that every
reversible engine between the same two temperatures has the same efficiency: it depends only on those temperatures.

### The Carnot efficiency

<mark data-tone="key">No real engine beats it.</mark> For an engine between a hot reservoir at $T_h$ and a cold one at
$T_c$, the best possible efficiency is:

:::formula[The Carnot efficiency]
$$\eta_C = 1 - \frac{T_c}{T_h}$$
- $\eta_C$ — the highest efficiency any engine can reach
- $T_c$ — temperature of the cold reservoir, in kelvin
- $T_h$ — temperature of the hot reservoir, in kelvin
:::

:::plot[The Carnot efficiency as the hot side heats up]
Move the cold side: a warmer cold reservoir lowers the whole curve.
$$\eta = 1 - \frac{T_c}{T}$$
- $T$ in [400, 1500] — hot reservoir (K)
- $T_c$ = 290 in [200, 400] — cold reservoir (K)
:::

### Worked example: a power station

Steam enters a turbine at 800 K and the condenser is cooled by a river at 300 K.

1. Both temperatures are already in kelvin: $T_h = 800$, $T_c = 300$.
2. $\eta_C = 1 - 300 / 800 = 1 - 0.375 = 0.625$.
3. So <mark data-tone="example">at most 62.5% of the heat can become work</mark>; the rest must go to the river.

:::warning
The usual mistake is to <mark data-tone="trap">put degrees Celsius in the formula</mark>. At 100 °C and 0 °C it would
give an efficiency of 1, which is impossible. In kelvin, 373 K and 273 K give about 0.27.
:::

:::cloze
An engine works between 600 K and 300 K. Its Carnot efficiency is {{0.5}}.
:::

## The four steps

The Carnot cycle is four reversible steps, two at constant temperature and two with no heat exchanged.

:::animate[The Carnot cycle, one step at a time]{replace}
1. $$T = T_h$$ **Isothermal expansion.** The gas touches the hot reservoir, takes in heat $Q_h$ and expands at constant temperature.
2. $$Q = 0$$ **Adiabatic expansion.** Insulated, the gas keeps expanding with no heat in or out, and cools from $T_h$ to $T_c$.
3. $$T = T_c$$ **Isothermal compression.** The gas touches the cold reservoir, gives out heat $Q_c$ and is compressed.
4. $$Q = 0$$ **Adiabatic compression.** Insulated again, it is compressed and warms back to $T_h$, ready for the next cycle.
:::

| Step | Heat | Volume |
|---|---|---|
| Isothermal expansion | in, $Q_h$ | grows |
| Adiabatic expansion | none | grows |
| Isothermal compression | out, $Q_c$ | shrinks |
| Adiabatic compression | none | shrinks |

:::order
Put the four steps of the Carnot cycle in order, starting with the gas at the hot reservoir.
1. Isothermal expansion
2. Adiabatic expansion
3. Isothermal compression
4. Adiabatic compression
:::

## In short

:::explain
Explain why heating the hot side and cooling the cold side both make an engine better.
> - The Carnot limit is one minus the ratio of the cold to the hot temperature.
> - A hotter hot side or a colder cold side makes that ratio smaller.
> - A smaller ratio raises the highest efficiency the engine can reach.
:::
