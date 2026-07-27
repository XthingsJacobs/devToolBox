## Base64 编码/解码

Base64 是一种把二进制数据转换为可打印文本的编码方式。它使用 64 个字符表示数据，每 6 个 bit 映射为一个字符，常见字符集为 `A-Z`、`a-z`、`0-9`、`+` 和 `/`，并使用 `=` 作为填充字符。

Base64 常用于邮件、JSON、XML、证书、图片 Data URL、Token 片段等需要在文本协议中传输二进制数据的场景。

### RFC 4648 标准字符索引表

<div class="table-wrap">
<table class="index-table">
<thead>
<tr><th>十进制</th><th>二进制</th><th>字符</th><th>十进制</th><th>二进制</th><th>字符</th><th>十进制</th><th>二进制</th><th>字符</th><th>十进制</th><th>二进制</th><th>字符</th></tr>
</thead>
<tbody>
<tr><td>0</td><td>000000</td><td>A</td><td>16</td><td>010000</td><td>Q</td><td>32</td><td>100000</td><td>g</td><td>48</td><td>110000</td><td>w</td></tr>
<tr><td>1</td><td>000001</td><td>B</td><td>17</td><td>010001</td><td>R</td><td>33</td><td>100001</td><td>h</td><td>49</td><td>110001</td><td>x</td></tr>
<tr><td>2</td><td>000010</td><td>C</td><td>18</td><td>010010</td><td>S</td><td>34</td><td>100010</td><td>i</td><td>50</td><td>110010</td><td>y</td></tr>
<tr><td>3</td><td>000011</td><td>D</td><td>19</td><td>010011</td><td>T</td><td>35</td><td>100011</td><td>j</td><td>51</td><td>110011</td><td>z</td></tr>
<tr><td>4</td><td>000100</td><td>E</td><td>20</td><td>010100</td><td>U</td><td>36</td><td>100100</td><td>k</td><td>52</td><td>110100</td><td>0</td></tr>
<tr><td>5</td><td>000101</td><td>F</td><td>21</td><td>010101</td><td>V</td><td>37</td><td>100101</td><td>l</td><td>53</td><td>110101</td><td>1</td></tr>
<tr><td>6</td><td>000110</td><td>G</td><td>22</td><td>010110</td><td>W</td><td>38</td><td>100110</td><td>m</td><td>54</td><td>110110</td><td>2</td></tr>
<tr><td>7</td><td>000111</td><td>H</td><td>23</td><td>010111</td><td>X</td><td>39</td><td>100111</td><td>n</td><td>55</td><td>110111</td><td>3</td></tr>
<tr><td>8</td><td>001000</td><td>I</td><td>24</td><td>011000</td><td>Y</td><td>40</td><td>101000</td><td>o</td><td>56</td><td>111000</td><td>4</td></tr>
<tr><td>9</td><td>001001</td><td>J</td><td>25</td><td>011001</td><td>Z</td><td>41</td><td>101001</td><td>p</td><td>57</td><td>111001</td><td>5</td></tr>
<tr><td>10</td><td>001010</td><td>K</td><td>26</td><td>011010</td><td>a</td><td>42</td><td>101010</td><td>q</td><td>58</td><td>111010</td><td>6</td></tr>
<tr><td>11</td><td>001011</td><td>L</td><td>27</td><td>011011</td><td>b</td><td>43</td><td>101011</td><td>r</td><td>59</td><td>111011</td><td>7</td></tr>
<tr><td>12</td><td>001100</td><td>M</td><td>28</td><td>011100</td><td>c</td><td>44</td><td>101100</td><td>s</td><td>60</td><td>111100</td><td>8</td></tr>
<tr><td>13</td><td>001101</td><td>N</td><td>29</td><td>011101</td><td>d</td><td>45</td><td>101101</td><td>t</td><td>61</td><td>111101</td><td>9</td></tr>
<tr><td>14</td><td>001110</td><td>O</td><td>30</td><td>011110</td><td>e</td><td>46</td><td>101110</td><td>u</td><td>62</td><td>111110</td><td>+</td></tr>
<tr><td>15</td><td>001111</td><td>P</td><td>31</td><td>011111</td><td>f</td><td>47</td><td>101111</td><td>v</td><td>63</td><td>111111</td><td>/</td></tr>
</tbody>
<tfoot><tr><td colspan="3">填充</td><td colspan="9">=</td></tr></tfoot>
</table>
</div>

## 示例

字符串 `Man` 的字节为 `77 97 110`，二进制合并后按 6 bit 分组，得到索引 `19 22 5 46`，对应 Base64 字符 `TWFu`。

<div class="table-wrap">
<table class="example-table">
<tbody>
<tr><th>文本</th><td colspan="8">M</td><td colspan="8">a</td><td colspan="8">n</td></tr>
<tr><th>ASCII</th><td colspan="8">77</td><td colspan="8">97</td><td colspan="8">110</td></tr>
<tr><th>索引</th><td colspan="6">19</td><td colspan="6">22</td><td colspan="6">5</td><td colspan="6">46</td></tr>
<tr><th>Base64</th><td colspan="6">T</td><td colspan="6">W</td><td colspan="6">F</td><td colspan="6">u</td></tr>
</tbody>
</table>
</div>

如果输入长度不是 3 字节的整数倍，会补零后再编码，并在输出末尾添加 `=` 表示填充。剩余 2 个字节时补 1 个 `=`，剩余 1 个字节时补 `==`。

## 常见变体

<div class="table-wrap">
<table class="variant-table">
<thead>
<tr><th>编码</th><th>第 62 位</th><th>第 63 位</th><th>填充</th><th>典型场景</th></tr>
</thead>
<tbody>
<tr><td>标准 Base64</td><td>+</td><td>/</td><td>=</td><td>MIME、PEM、通用文本传输</td></tr>
<tr><td>base64url</td><td>-</td><td>_</td><td>可省略</td><td>URL、JWT、文件名安全场景</td></tr>
<tr><td>IMAP Modified Base64</td><td>+</td><td>,</td><td>无</td><td>IMAP UTF-7</td></tr>
</tbody>
</table>
</div>

标准 Base64 中的 `+`、`/` 和 `=` 在 URL 或文件名中可能需要额外转义。需要用于 URL 时，通常使用 base64url 变体。
