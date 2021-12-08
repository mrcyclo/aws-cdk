#!/bin/bash
sudo -i
amazon-linux-extras enable php7.4 epel && yum clean metadata
yum install -y unzip curl httpd php php-common php-pgsql php-curl php-gd php-mbstring php-xmlrpc php-intl php-zlib php-bcmath php-xml
curl -sS https://getcomposer.org/installer | php -- --install-dir=/bin --filename=composer
cd /var/www/html
composer create-project laravel/laravel .
echo "
<VirtualHost *:80>
	DocumentRoot /var/www/html/public
	<Directory /var/www/html/public>
		Order allow,deny
		Allow from all
		AllowOverride all
	</Directory>
</VirtualHost>
" > /etc/httpd/conf.d/web.conf
systemctl start httpd
systemctl enable httpd
