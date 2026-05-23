# Radio Feature Updates

## Task 1: Radio auto-expanded by default
- All genres in M2 (#arcRadioTracklist) should be open by default
- M1 wamp radio body should be visible by default  
- M3 CLI radio body should be visible by default

## Task 2: Coin-to-Dafoe-Jesus animation
- On radio station switch, stop, or play: animate a coin with stardust flying to a Dafoe-Jesus figure
- Dafoe-Jesus image: https://storage.googleapis.com/runable-templates/cli-uploads%2FU4EzLJPYhEsWbQntf5C8L39kulHTTY2E%2Frrcm-9aWWtfF9Gt1nIaND%2Fdafoe_small.png
- Fixed position in corner, coin flies from center of screen to the figure
- Stardust trail behind the coin

## Changes needed:
1. In `radRenderArcRadio()` - init `_radOpenGenres` with all genres open
2. In M1 wampRadioBody - default display:block, render on init
3. In M3 cliRadioBody - default display:block, render on init
4. Add CSS for coin animation + stardust + Dafoe Jesus figure
5. Add HTML for the fixed Dafoe Jesus overlay
6. Add `radCoinAnimation()` function
7. Call `radCoinAnimation()` from `radPlayStation()` and `radStop()`

## Status: IN PROGRESS
