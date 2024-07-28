---
layout: ../../layouts/post.astro
title: Навигация с клавиатуры
pubDate: 2020-06-05
excerpt: The power of the Web is in its universality. Access by everyone regardless of disability is an essential aspect. Tim Berners-Lee, W3C Director and inventor of the World Wide Web
description: 'SEO description'
image:
  src:
  alt:
tags: ['accessibility', 'html', 'css']
---

<blockquote class="quote quote--right">
  <p>&ldquo;The power of the Web is in its universality. Access by everyone regardless of disability is an essential aspect.&rdquo;</p>
  <footer>Tim Berners-Lee, W3C Director and inventor of the World Wide Web</footer>
</blockquote>

В большинстве статей по [Accessibility](https://www.w3.org/WAI/fundamentals/accessibility-intro/#context) вы прочтете, что доступность помогает людям с ограниченными возможностями. Но зачастую, мы не задумываемся об этом совсем или задумываемся в последнюю очередь (сроки то горят), лишая многих людей возможности пользоваться нашим приложением. Но сегодня я хочу поговорить именно о нас с вами, и о том, как мы можем упростить свою жизнь. Как вы уже поняли из названия, речь пойдет не об [Accessibility](https://www.w3.org/WAI/fundamentals/accessibility-intro/#context) в целом, а только об одном её аспекте - навигации с клавиатуры. Наверняка вы спросите "почему это так важно? и вообще, у меня есть мышка!", но если задуматься, в некоторых ситуациях и мы с вами - "люди с ограниченными возможностями". Представьте, что вы сломали руку, или у вас сломалась мышка (а вы сидите такой на карантине 😒), в обоих случаях у вас "ограниченные возможности", и вам будет гораздо проще пользоваться приложением, если разработчики позаботились о навигации с клавиатуры. Да и вообще, зачастую клавиатурой пользоваться удобнее и быстрее. Сам я впервые столкнулся с проблемой доступности ещё в школе, когда родители прятали мышку, чтобы я не играл в игры и учил уроки 😁.

Допустим, вы решили добавить в свое приложение навигацию с клавиатуры, итак, какие существуют критерии, и на что необходимо обратить внимание? Здесь я не буду много говорить о реализации, а просто остановлюсь на основных моментах и концепциях. Далее, для краткости, под доступность я буду понимать именно доступность с клавиатуры.

## Как узнать, доступно ли приложение с клавиатуры?

В первую очередь откройте ваше приложение и выбросьте мышку (желательно не далеко, она вам ещё понадобится). Затем попробуйте перемещаться по интерактивным элементам на странице: просто нажмите <span class="key">TAB</span> для перехода к следующему элементу и <span class="key">SHIFT</span> + <span class="key">TAB</span> для перехода к предыдущему. Так же вы должны иметь возможность взаимодействовать с интерактивными элементами: нажимать на кнопки с помощью <span class="key">Enter</span> и <span class="key">Spacebar</span>, менять значения чекбоксов с помощью <span class="key">Spacebar</span> и т.д.. Таким образом, если мы можем взаимодействовать со всеми элементами на странице с помощью клавиатуры, то наш приложение - доступно. На самом деле это только часть критерия, вторая часть состоит в том, что вам не нужно удерживать клавиши определенное количество времени для генерации события или вызова действия, но и здесь есть свои исключения, например: приложения для рисования и различные симуляторы. В статье речь пойдет только о первой части критерия.

## Все функциональные элементы должны быть интерактивными

В первую очередь необходимо убедиться, что все функциональные элементы: кнопки, чекбоксы, формы и т.д. являются интерактивными, т.е. вы можете взаимодействовать с ними с помощью клавиатуры. В принципе, если у вас нет [диватоза](https://youtu.be/ssJsjGZE2sc?t=652) (вы используете правильные семантические теги), то возможно данное условие для вас уже выполнено. Но боюсь, в большинстве случаев этого недостаточно, иначе все было бы ну уж слишком просто. Перечень стандартных тегов, скорее всего, нас не удовлетворяет и мы начинаем создавать собственные компоненты: [деревья](https://www.w3.org/TR/wai-aria-practices/#TreeView), [таб контейнеры](https://www.w3.org/TR/wai-aria-practices/#tabpanel), [breadcrumb](https://www.w3.org/TR/wai-aria-practices/#breadcrumb) ..., которые мы будем реализовывать на базе неинтерактивных элементов, таких как: `div`, `span`, `section` и т.д. Чтобы сделать неинтерактивный элемент интерактивным, нужно использовать атрибут `tabindex`.

О том как создавать сложные компоненты доступные с клавиатуры, можно почитать [здесь](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Keyboard-navigable_JavaScript_widgets#main-q). Также существуют [описание с примерами реализаций наиболее распространенных компонентов](https://www.w3.org/TR/wai-aria-practices/#breadcrumb), где вы можете найти какие виды взаимодействия с клавиатуры они должны поддерживать.

## Легко определяемое положение фокуса

Браузеры по умолчанию предоставляю стандартные стили для элементов в фокусе. Например, Chrome и Safari рисуют голубой контур вокруг сфокусированного элемента, который не так сложно заметить. В то время как Firefox и IE рисуют едва заметную пунктирную линию, которую даже зрячий человек заметит с трудом. И те, и другие стили выглядят недостаточно привлекательно и вполне могут конфликтовать с вашим дизайном, поэтому во многих приложениях разработчики просто сбрасывают их с помощью следующего CSS.

```css
:focus {
	outline: 0;
}
```

В данном случае пользователь совсем теряет возможность использовать клавиатуру, поэтому ни в коем случае не делайте этого, если не собираетесь предоставить другой индикатор фокуса. Зачастую вы можете использовать для `:focus` те же стили, что используете для `:hover`.

```css
button {
  ...;
}
button:hover,
button:focus {
  // здесь будут ваши стили для ховера и для фокуса
  ...;
}
```

Подробнее об этом вы можете почитать [здесь](https://www.w3.org/TR/UNDERSTANDING-WCAG20/navigation-mechanisms-focus-visible.html).

## Порядок элементов

Теперь, когда вы можете перемещаться по странице с помощью одной лишь клавиатуры, необходимо проверить порядок, в котором вы переходите по элементам - он должен быть логичным и интуитивно понятным. Обычно он просто совпадает с визуальным потоком страницы, или проще говоря соответствует тому, как вы читает - слева направо и сверху вниз (если вы поддерживаете только языки с таким направлением чтения). Именно поэтому порядок, в котором вы объявляете HTML элементы имеет значение, ведь именно в этом порядке будет происходить табуляция по элементам, а не в их визуальном порядке.

Наглядными нарушителями порядка 👮‍♂️‍ элементов, могут служить свойства [order](https://developer.mozilla.org/en-US/docs/Web/CSS/order) и [float](https://developer.mozilla.org/en-US/docs/Web/CSS/float). Ниже вы видите три набора кнопок, в первом не используются никакие свойства для их упорядочивания, поэтому визуальный порядок совпадает с порядком табуляции, во втором и третьем же визуальный порядок отличается от порядка объявления элементов в HTML. Нажмите на кнопку "Button 1" из первой четверки и обойдите все 12 кнопок с помощью клавиши <span class="key">TAB</span>, заметили разницу?

<p class="codepen" data-height="439" data-theme-id="light" data-default-tab="html,result" data-user="cherkalexander" data-slug-hash="oNjKKxb" style="height: 439px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 2px solid; margin: 1em 0; padding: 1em;" data-pen-title="Tab ordering">
  <span>See the Pen <a href="https://codepen.io/cherkalexander/pen/oNjKKxb">
  Tab ordering</a> by Alexander Cherkashin (<a href="https://codepen.io/cherkalexander">@cherkalexander</a>)
  on <a href="https://codepen.io">CodePen</a>.</span>
</p>
<script async src="https://static.codepen.io/assets/embed/ei.js"></script>

Помимо этого, необходимо стараться избегать употребления позитивных значений `tabindex`, так как такие элементы помещаются перед дефолтными интерактивными элементами (c `tabindex="0"`), и это означает лишь одно - разработчиками придется устанавливать (и поддерживать) значения `tabindex` для всех фокусируемых элементов, чтобы обеспечить верный порядок навигации. Подробнее о свойстве `tabindex` можно почитать на [данной странице](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Keyboard-navigable_JavaScript_widgets).

Но всё же, иногда необходимо изменять стандартный порядок элементов, например, если вы вам необходимо, чтобы элементы получали фокус в порядке убывания их важности. Так на главной странице Яндекса главным элементом является строка поиска, и именно она первой получает фокус, поэтому при открытии страницы вы сразу можете начинать печатать поисковой запрос, ведь курсор уже находится в нужном месте. Вот так выглядит карта навигации для главной страницы Яндекса.

<div class="centering">

![Карта навигации Яндекса](/public/keyboard-navigation/yandex-keyboard-order.gif)

</div>

## Ссылка "Перейти к содержимому"

Если вы дошли до этого пункта, то ваше приложение уже достаточно доступное и люди могут пользоваться им с клавиатуры. Однако, нет предела совершенству, верно? Дело в том, что есть одна важная особенность, которая отличает пользователей с мышью от пользователей с клавиатурой. Первые могут сразу перейти к интересующему их контенты, в то время как пользователи с клавиатурой должны десятки раз нажать TAB, чтобы пролистать вечно повторяющиеся заголовки и панели навигаций. Но вы можете упростить им жизнь, добавив ссылку "Перейти к содержимому".

Обычно эта ссылка:

1. самый первый элемент, получающий фокус;
2. невидима, пока не получит фокус, именно поэтому большинство людей, которые используют только мышку, даже не догадываются о её существовании;
3. реализуется с помощью [якорей](https://htmlacademy.ru/courses/305/run/5).

Нажмите чуть выше заголовка в примере, чтобы sandbox получил фокус и нажмите кнопку <span class="key">TAB</span>, чтобы посмотреть реализацию.

<p class="codepen" data-height="400" data-theme-id="light" data-default-tab="result" data-user="cherkalexander" data-slug-hash="dyYxxgW" style="height: 400px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 2px solid; margin: 1em 0; padding: 1em;" data-pen-title="Skip to main content pattern">
  <span>See the Pen <a href="https://codepen.io/cherkalexander/pen/dyYxxgW">
  Skip to main content pattern</a> by Alexander Cherkashin (<a href="https://codepen.io/cherkalexander">@cherkalexander</a>)
  on <a href="https://codepen.io">CodePen</a>.</span>
</p>
<script async src="https://static.codepen.io/assets/embed/ei.js"></script>

## Удержание фокуса

Я уверен, пользователи уже очень довольны доступностью вашего приложения, однако есть ещё одна потенциальная проблема. Дело в том, что фокус не должен выходить за пределы модальных элементов (например за пределы модального окна), иначе пользователь сможет взаимодействовать с остальным содержимым на странице. В этом есть смысл, ведь, если диалог открыт, то вероятнее всего (но не 100%), пользователь должен взаимодействовать только с его содержимым и не выходить за его пределы, пока не закроет диалог. Также это может привести к ситуации, в которой пользователь не сможет увидеть какой элемент владеет фокусом. Как вы наверняка помните, у многих компонентов существует описание общепринятого взаимодействия с клавиатурой, так вот, диалог не является исключением, подробнее об этом вы можете почитать [здесь](https://www.w3.org/TR/wai-aria-practices-1.1/#dialog_modal), а о примерах реализации удержания фокуса [здесь](https://css-tricks.com/a-css-approach-to-trap-focus-inside-of-an-element/).

## Горячие клавиши

Также не будет лишним добавить различные стандартные сочетания клавиш. Например, если вы разрабатываете графический редактор, то имеет смысл добавить такие сочетания как <span class="key">CTRL</span> + <span class="key">Z</span>, <span class="key">CTRL</span> + <span class="key">Y</span> для отмены и применения действия или же <span class="key">CTRL</span> + <span class="key">S</span> для сохранения внесенных изменений. Я не зря сказал "стандартные", ведь именно эти сочетания пользователи могут машинально использовать в вашем приложении, ведь все знают (все же, правда?), что <span class="key">CTRL</span> + <span class="key">S</span> - это сохранить. Также можно добавлять и кастомные сочетания клавиш, но в этом случае необходимо подсказать пользователю о их существовании. Обычно разработчики добавляют небольшие подсказки, используют `placeholder` для текстовых полей или отображают комбинации клавиш в тултипах. Приведу несколько примеров:

- Подсказки в тултипах в [VsCode](https://code.visualstudio.com/)

![Тултипы в VsCode](/public/keyboard-navigation/vscode-tooltip.gif)

- Подсказка в правой части поля поиска на [GitHub](https://github.com/), для фокусировки необходимо нажать <span class="key">/</span>

![Поле поиска на github, для фокусировки необходимо нажать "/"](/public/keyboard-navigation/github-searchbox.png)

- Подсказка в placeholder'е на сайте библиотеки [Vuetify](https://vuetifyjs.com/en/), для фокусировки необходимо нажать <span class="key">/</span>

![Поле поиска на vuetifyjs, для фокусировки необходимо нажать "/"](/public/keyboard-navigation/vuetifyjs-searchbox.png)

## Все ли можно сделать доступным с клавиатуры?

Очень хороший вопрос, и ответ на него - НЕТ! [Здесь](https://www.w3.org/TR/UNDERSTANDING-WCAG20/keyboard-operation-keyboard-operable.html) вы можете найти исключения из правил. Как я уже говорил в начале, приложения для рисования нельзя сделать доступными, так как они очень завязаны на движения пользователя, так же как и различные обучающие симуляторы (например, симулятор полетов на вертолете). Однако, это относится не ко всем графическим редакторам, а только к тем, где пользователь рисует с помощью "карандаша" или "кисти". Вполне возможно сделать доступным редактор для рисования геометрических фигур, например, чтобы добавить прямоугольник, нам всего то нужно указать его координаты и размер.

А теперь ответьте мне на вопрос, можем ли мы сделать доступной функцию Drag and Drop? В том виде, в котором она существует - явно нет, ведь эта функция также как и в случае с рисованием очень зависит от движений пользователя, однако мы можем реализовать перемещение объектов с помощью стрелок. Очень распространенным применением Drap and Drop является палитра компонентов, в которой вы выбираете объект и бросаете его, например, на холст, в этом случае мы можем сделать функцию доступной следующим образом:

- Переходим в палитру компонентов;
- Перемещаемся на нужный элемент;
- Нажимаем <span class="key">CTRL</span> + <span class="key">C</span>;
- Перемещаемся на холст;
- Нажимаем <span class="key">CTRL</span> + <span class="key">V</span>;

## Тестирование вместо заключения

Теперь, когда всё готово, откройте ещё раз свое приложение и ответьте на следующие вопросы:

- Можете ли вы попасть на каждый элемент?
- Можете ли вы взаимодействовать с каждыми элементом?
- Доступны ли вам все возможности приложения без использования мышки (не считая ранее оговоренных исключений)?
- Легко ли определить текущее положение фокуса на странице?
- Заперт ли фокус внутри модальных элементов?

Если вы можете ответить на все эти вопросы положительно - поздравляю.

Как видите, для тестирования вам не нужен какой либо специальный софт. Однако, пока я писал данную статью, я нашел пару расширений для хрома, которые вы возможно сочтёте полезными: [Accessibility Insights](https://accessibilityinsights.io/) и [deque](www.deque.com).

## Полезные ссылки

- [Отличное видео от Microsoft о том как "работает" доступность](https://www.youtube.com/watch?v=HE2R86EZPMA&feature=youtu.be)
- [Как помочь слепым на вашем сайте](https://weblind.ru/)
- [Гайдлайн от сбербанка](http://specialbank.ru/guide/)
- [Keyboard-navigable JavaScript widgets](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Keyboard-navigable_JavaScript_widgets#main-q)
- [Keyboard-Only Navigation for Improved Accessibility](https://www.nngroup.com/articles/keyboard-accessibility/)
- [8 Website Accessibility Best Practices to Improve UX](https://www.uxpin.com/studio/blog/8-website-accessibility-best-practices-to-improve-ux/)
- [I Used The Web For A Day With Just A Keyboard](https://www.smashingmagazine.com/2018/07/web-with-just-a-keyboard/)
- [Keyboard Accessibility](https://webaim.org/techniques/keyboard/)