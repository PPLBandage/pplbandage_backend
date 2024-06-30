# Eldraxis.js
[![Made with Prisma](http://made-with.prisma.io/indigo.svg)](https://prisma.io)<br/>
[![Made for pepeland](https://andcool.ru/static/badges/made-for-ppl.svg)](https://pepeland.net)
### **Порт [оригинального Eldraxis](https://github.com/Andcool-Systems/Eldraxis) на nest.js.**

## Бенчмарки
|              | Eldraxis | Eldraxis.js |
|--------------|----------|-------------|
| /skin        | ~700ms   | ~168ms      |
| /skin/*uuid* | ~400ms   | ~120ms      |
| /head        | ~600ms   | ~170ms      |
| /cape        | ~800ms   | ~110ms      |
| /head3d      | ~700ms   | -           |
| /search      | ~200ms   | ~80ms       |
| /profile     | ~800ms   | ~154ms      |

>[!NOTE]
> Все бенчмарки проведены на моём ПК и стоит учитывать поправку на скорость моего интернета.  
> Во всех тестах был использован кэш скинов и примерно равные условия. Если передавать в `/skin` не никнейм, а UUID, то времени на обработку будет затрачено чуть меньше, так как не делается лишний запрос к серверам Mojang.

*Скорее всего это я криворукий и не умею программировать, но проект был доработан и ускорен 4 раза, что неплохо*
